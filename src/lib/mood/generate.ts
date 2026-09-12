import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal, type TasteSignal } from "@/lib/recommendations/signals";
import { AI_FAILURE_COPY, isAiConfigured, type AiFailureReason } from "@/lib/ai/service";
import { getCandidatePool, type MoodCandidate } from "@/lib/mood/candidates";
import { curateWithAi, interpretMoodWithAi } from "@/lib/mood/ai";
import {
  composeDescription,
  composeTitle,
  composeWhyThisList,
  personalizationLevel,
} from "@/lib/mood/compose";
import { isEmptyIntent, parseMoodIntent, type MoodIntent, type MoodRequest } from "@/lib/mood/intent";
import { diversify, diversifyReasons, rankCandidates, type RankContext, type ScoredCandidate } from "@/lib/mood/rank";
import { AUDIENCE_RULES } from "@/lib/mood/vocabulary";
import type { GeneratedMoodWatchlist, MoodWatchlistItem } from "@/lib/mood/watchlist-types";

/**
 * The mood watchlist pipeline (§2, §52):
 *
 *   request -> intent -> real candidates -> taste-aware ranking -> curation -> explanation
 *
 * Aurora owns retrieval, ranking and diversity. The AI is a curation and
 * language layer on top of a list that is already correct without it, which is
 * why every AI step here can fail without changing what the user gets — only
 * how it is worded.
 */

/** Below this many deliberate signals, Aurora doesn't claim to know the user's taste (§40). */
const MIN_SIGNALS_FOR_PERSONALIZATION = 5;

function toItem(scored: ScoredCandidate): MoodWatchlistItem {
  return {
    card: scored.candidate.card,
    reason: scored.reason,
    reasonType: scored.reasonType,
    runtimeMin: scored.candidate.runtimeMin,
    year: scored.candidate.year,
  };
}

function topGenres(signal: TasteSignal, limit = 3): string[] {
  return [...signal.genreWeights.entries()]
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([g]) => g);
}

/** Compact, real taste facts for the curation prompt — never the whole library (§36). */
function tasteSummary(signal: TasteSignal): string[] {
  const summary: string[] = [];
  const genres = topGenres(signal, 3);
  if (genres.length > 0) summary.push(`Rates these genres highly: ${genres.join(", ")}`);

  const moods = [...signal.moodWeights.entries()]
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);
  if (moods.length > 0) summary.push(`Gravitates toward: ${moods.join(", ")}`);

  const liked = signal.likedTitles
    .filter((t) => typeof t.score === "number" && t.score >= 4)
    .slice(0, 5)
    .map((t) => `${t.title} (${t.score}/5)`);
  if (liked.length > 0) summary.push(`Rated highly: ${liked.join(", ")}`);

  const creators = [...signal.directorWeights.entries()]
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
  if (creators.length > 0) summary.push(`Returns to these creators: ${creators.join(", ")}`);

  return summary;
}

function describeIntent(intent: MoodIntent): string {
  const parts: string[] = [];
  if (intent.moods.length > 0) parts.push(`moods ${intent.moods.join("/")}`);
  if (intent.genres.length > 0) parts.push(`genres ${intent.genres.join("/")}`);
  if (intent.excludeGenres.length > 0) parts.push(`excluding ${intent.excludeGenres.join("/")}`);
  if (intent.excludeMoods.length > 0) parts.push(`avoiding ${intent.excludeMoods.join("/")}`);
  if (intent.runtimeMaxMin) parts.push(`at most ${intent.runtimeMaxMin} minutes`);
  if (intent.audience) parts.push(`watching ${AUDIENCE_RULES[intent.audience].label}`);
  if (intent.recency !== "any") parts.push(intent.recency === "new" ? "recent releases" : "older titles");
  if (intent.similarTo) parts.push(`similar to ${intent.similarTo}`);
  return parts.length > 0 ? parts.join(", ") : "no specific constraints";
}

function buildRankContext(
  intent: MoodIntent,
  signal: TasteSignal,
  request: MoodRequest,
  similar: { title: string; genres: string[]; moods: string[] } | null,
  hasSignal: boolean
): RankContext {
  return {
    intent,
    exploration: request.exploration,
    similar,
    genreWeights: signal.genreWeights,
    moodWeights: signal.moodWeights,
    recentGenreWeights: signal.recentGenreWeights,
    directorWeights: signal.directorWeights,
    likedTitles: signal.likedTitles.map((t) => ({
      title: t.title,
      genres: t.genres,
      creator: t.creator,
      score: t.score,
    })),
    softDownranked: signal.softDownranked,
    hasSignal,
  };
}

/**
 * Merges the structured controls the user set in the UI into the parsed intent.
 * An explicit control always wins over an inference from the sentence — the
 * user picking "under 90 minutes" is more reliable than Aurora reading it.
 */
function applyControls(intent: MoodIntent, request: MoodRequest): MoodIntent {
  const contentTypes =
    request.contentType === "any"
      ? intent.contentTypes
      : ([request.contentType] as MoodIntent["contentTypes"]);

  return {
    ...intent,
    contentTypes,
    audience: request.audience ?? intent.audience,
    runtimeMaxMin: request.runtimeMaxMin ?? intent.runtimeMaxMin,
  };
}

export interface GenerateOptions {
  /** Varies deterministic titling on a regenerate. */
  seed?: number;
  /** Content ids the user has already removed or is replacing — never re-offered. */
  excludeIds?: string[];
}

export async function generateMoodWatchlist(
  userId: string,
  request: MoodRequest,
  options: GenerateOptions = {}
): Promise<GeneratedMoodWatchlist> {
  const seed = options.seed ?? 0;
  const excluded = new Set(options.excludeIds ?? []);

  const [genreRows, signal] = await Promise.all([
    prisma.genre.findMany({ select: { name: true } }),
    buildTasteSignal(userId),
  ]);
  const knownGenres = genreRows.map((g) => g.name);

  // Aurora always parses the request itself. The deterministic pass is what
  // supplies the concept keys used for titling, and it is the result Aurora
  // falls back to whenever the AI path is unavailable or unusable.
  const localIntent = parseMoodIntent(request.prompt, knownGenres);

  let aiInterpreted = false;
  let aiNote: AiFailureReason | null = null;
  let intent = localIntent;

  if (isAiConfigured()) {
    const outcome = await interpretMoodWithAi(request.prompt, knownGenres);
    if (outcome.ok) {
      aiInterpreted = true;
      // Keep Aurora's concept keys: they drive titling and are not something
      // the model is asked to produce.
      intent = { ...outcome.data, concepts: localIntent.concepts };
    } else {
      aiNote = outcome.reason;
    }
  } else {
    aiNote = "unconfigured";
  }

  intent = applyControls(intent, request);

  // A request Aurora couldn't read at all still has to return something useful:
  // fall back to the user's taste rather than an empty list.
  const usableIntent = isEmptyIntent(intent) && signal.hasSignal
    ? { ...intent, genres: topGenres(signal, 3) }
    : intent;

  const pool = await getCandidatePool(usableIntent, signal);
  const similar = pool.similar;
  const candidates = excluded.size > 0
    ? pool.candidates.filter((c) => !excluded.has(c.card.id))
    : pool.candidates;

  const signalCount = signal.likedTitles.length;
  const hasSignal = signal.hasSignal && signalCount >= MIN_SIGNALS_FOR_PERSONALIZATION;

  const ctx = buildRankContext(usableIntent, signal, request, similar, hasSignal);
  const ranked = rankCandidates(candidates, ctx);
  const shortlist = diversifyReasons(diversify(ranked, request.size));

  const level = personalizationLevel(shortlist, hasSignal, request.exploration);

  let items = shortlist.map(toItem);
  let title = composeTitle(usableIntent, seed);
  // Describe what actually ended up in the list.
  const listGenres = [...new Set(shortlist.map((s) => s.candidate.card.genres?.[0]).filter((x): x is string => !!x))];
  let description = composeDescription(usableIntent, items.length, listGenres.slice(0, 2));
  let whyThisList = composeWhyThisList({
    intent: usableIntent,
    items: shortlist,
    level,
    tasteGenres: topGenres(signal),
    similarTitle: similar?.title ?? null,
  });
  let aiCurated = false;

  if (isAiConfigured() && ranked.length > 0) {
    const outcome = await curateWithAi(ranked, {
      prompt: request.prompt,
      intentSummary: describeIntent(usableIntent),
      tasteSummary: hasSignal ? tasteSummary(signal) : [],
      exploration: request.exploration,
      size: request.size,
    });

    if (outcome.ok) {
      const byId = new Map(ranked.map((r) => [r.candidate.card.id, r]));
      const curated = outcome.data.items
        .map((item) => {
          const scored = byId.get(item.contentId);
          if (!scored) return null;
          return { ...toItem(scored), reason: item.reason, reasonType: item.reasonType };
        })
        .filter((item): item is MoodWatchlistItem => item !== null);

      if (curated.length > 0) {
        aiCurated = true;
        items = curated.slice(0, request.size);
        title = outcome.data.title;
        description = outcome.data.description;
        if (outcome.data.whyThisList) whyThisList = outcome.data.whyThisList;
      }
    } else {
      aiNote = outcome.reason;
    }
  }

  return {
    title,
    description,
    whyThisList,
    personalization: level,
    intent: usableIntent,
    exploration: request.exploration,
    prompt: request.prompt,
    items,
    ai: {
      interpreted: aiInterpreted,
      curated: aiCurated,
      configured: isAiConfigured(),
      // Only explain the absence when the AI didn't end up doing the curation.
      note: aiCurated || aiNote === null ? null : AI_FAILURE_COPY[aiNote],
    },
    insufficientData: !hasSignal,
    poolSize: candidates.length,
  };
}

export type { MoodCandidate };
export type { GeneratedMoodWatchlist, MoodWatchlistItem } from "@/lib/mood/watchlist-types";

/**
 * Picks a single replacement for one item (§26).
 *
 * Runs the same retrieval and ranking as a full generation but returns only the
 * best remaining candidate, so swapping one title never disturbs the rest of
 * the list — and never costs an AI call.
 */
export async function pickReplacementItem(
  userId: string,
  request: MoodRequest,
  excludeIds: string[]
): Promise<MoodWatchlistItem | null> {
  const [genreRows, signal] = await Promise.all([
    prisma.genre.findMany({ select: { name: true } }),
    buildTasteSignal(userId),
  ]);

  const intent = applyControls(parseMoodIntent(request.prompt, genreRows.map((g) => g.name)), request);
  const { candidates, similar } = await getCandidatePool(intent, signal);

  const excluded = new Set(excludeIds);
  const remaining = candidates.filter((c) => !excluded.has(c.card.id));
  if (remaining.length === 0) return null;

  const hasSignal = signal.hasSignal && signal.likedTitles.length >= MIN_SIGNALS_FOR_PERSONALIZATION;
  const ranked = rankCandidates(remaining, buildRankContext(intent, signal, request, similar, hasSignal));
  const best = ranked[0];
  return best ? toItem(best) : null;
}
