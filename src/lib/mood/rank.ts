import { AUDIENCE_RULES, type Exploration } from "@/lib/mood/vocabulary";
import type { MoodCandidate } from "@/lib/mood/candidates";
import type { MoodIntent } from "@/lib/mood/intent";

/**
 * Candidate ranking (§10) and the evidence that justifies each pick (§16, §36).
 *
 * Pure by design — it takes plain maps rather than a Prisma client or a
 * TasteSignal, so the whole scoring model is unit-testable without a database.
 * Aurora ranks; the AI only ever curates what ranking already produced.
 */

/** The reason vocabulary (§32). A reason is always the component that actually won. */
export type MoodReasonType =
  | "MOOD_MATCH"
  | "TASTE_MATCH"
  | "RECENT_INTEREST"
  | "CREATOR_MATCH"
  | "GENRE_MATCH"
  | "CONTEXT_MATCH"
  | "EXPLORATION"
  | "RUNTIME_MATCH";

export const MOOD_REASON_TYPES: MoodReasonType[] = [
  "MOOD_MATCH",
  "TASTE_MATCH",
  "RECENT_INTEREST",
  "CREATOR_MATCH",
  "GENRE_MATCH",
  "CONTEXT_MATCH",
  "EXPLORATION",
  "RUNTIME_MATCH",
];

export interface LikedTitle {
  title: string;
  genres: string[];
  creator?: string | undefined;
  score?: number | undefined;
}

export interface RankContext {
  intent: MoodIntent;
  exploration: Exploration;
  similar: { title: string; genres: string[]; moods: string[] } | null;
  genreWeights: Map<string, number>;
  moodWeights: Map<string, number>;
  recentGenreWeights: Map<string, number>;
  directorWeights: Map<string, number>;
  likedTitles: LikedTitle[];
  /** `${ContentType}:${id}` the user said "less like this" about — ranked down, never removed. */
  softDownranked: Set<string>;
  /** False when the user has too little history for taste terms to mean anything (§40). */
  hasSignal: boolean;
}

export interface ReasonOption {
  type: MoodReasonType;
  reason: string;
  value: number;
}

export interface ScoredCandidate {
  candidate: MoodCandidate;
  score: number;
  reasonType: MoodReasonType;
  reason: string;
  /**
   * Every true claim that could have been made about this pick, strongest
   * first. Kept so a list can vary its wording without ever reaching for a
   * reason that isn't supported by the evidence.
   */
  alternatives: ReasonOption[];
  /** Whether taste history contributed at all — drives personalization strength (§18). */
  tasteBacked: boolean;
}

/**
 * Exploration controls how far Aurora moves from established taste (§19).
 * "surprise" doesn't discard taste — it down-weights it and pays a bonus for
 * under-seen titles, so results stay relevant while leaving the comfort zone.
 */
const EXPLORATION_WEIGHTS: Record<Exploration, { taste: number; novelty: number }> = {
  close: { taste: 1.35, novelty: 0 },
  balanced: { taste: 1, novelty: 0.35 },
  surprise: { taste: 0.45, novelty: 1.2 },
};

function weightOf(map: Map<string, number>, keys: string[] | undefined): number {
  if (!keys) return 0;
  return keys.reduce((sum, key) => sum + Math.max(0, map.get(key) ?? 0), 0);
}

function overlap(a: string[] | undefined, b: string[]): string[] {
  if (!a || b.length === 0) return [];
  const set = new Set(b);
  return a.filter((x) => set.has(x));
}

function lower(text: string): string {
  return text.toLowerCase();
}

/** Scores one candidate and records which component justified it. */
export function scoreCandidate(candidate: MoodCandidate, ctx: RankContext): ScoredCandidate {
  const { intent } = ctx;
  const { card } = candidate;
  const weights = EXPLORATION_WEIGHTS[ctx.exploration];

  const matchedMoods = overlap(card.moods, intent.moods);
  const matchedGenres = overlap(card.genres, intent.genres);
  const similarGenres = ctx.similar ? overlap(card.genres, ctx.similar.genres) : [];
  const similarMoods = ctx.similar ? overlap(card.moods, ctx.similar.moods) : [];

  const moodScore = matchedMoods.length * 9;
  const genreScore = matchedGenres.length * 6;
  const similarScore = (similarGenres.length * 4 + similarMoods.length * 3) * (ctx.similar ? 1 : 0);

  const tasteGenre = ctx.hasSignal ? weightOf(ctx.genreWeights, card.genres) : 0;
  const tasteMood = ctx.hasSignal ? weightOf(ctx.moodWeights, card.moods) * 0.6 : 0;
  const tasteScore = (tasteGenre + tasteMood) * weights.taste;

  const recentScore = ctx.hasSignal ? weightOf(ctx.recentGenreWeights, card.genres) * 1.2 : 0;
  const creatorScore = card.creator ? Math.max(0, ctx.directorWeights.get(card.creator) ?? 0) * 4 : 0;

  // Context: an audience lean, or an explicit recency ask that this title meets.
  const audienceRules = intent.audience ? AUDIENCE_RULES[intent.audience] : null;
  const contextGenres = audienceRules ? overlap(card.genres, audienceRules.favorGenres) : [];
  const contextScore = contextGenres.length * 5;

  // Runtime only scores when the user actually set a ceiling and we know the runtime.
  const runtimeFits = intent.runtimeMaxMin !== null && candidate.runtimeMin !== null && candidate.runtimeMin <= intent.runtimeMaxMin;
  const runtimeScore = runtimeFits ? 6 : 0;
  // An unknown runtime under an explicit cap is a weaker answer, never a claim.
  const runtimeUnknownPenalty = intent.runtimeMaxMin !== null && candidate.runtimeMin === null ? -4 : 0;

  const quality = (card.rating ?? 0) * 0.8;
  // Corroboration: retrieved by more than one independent route.
  const corroboration = (candidate.sources.length - 1) * 2;
  // Novelty rewards the under-seen half of the catalog when exploring.
  const novelty = candidate.sources.includes("hidden_gem") ? 8 * weights.novelty : 0;

  const downranked = ctx.softDownranked.has(`${card.kind}:${card.id}`) ? -25 : 0;

  const score =
    moodScore +
    genreScore +
    similarScore +
    tasteScore +
    recentScore +
    creatorScore +
    contextScore +
    runtimeScore +
    runtimeUnknownPenalty +
    quality +
    corroboration +
    novelty +
    downranked;

  // The reason must name the component that actually won, not the nicest-sounding
  // one. Ties resolve toward the most specific, checkable claim.
  const components: ReasonOption[] = [];

  if (creatorScore > 0 && card.creator) {
    components.push({
      type: "CREATOR_MATCH",
      value: creatorScore,
      reason: `From ${card.creator}, who keeps coming up in what you rate highly.`,
    });
  }
  if (matchedMoods.length > 0) {
    const moodPhrase = matchedMoods.slice(0, 2).map(lower).join(" and ");
    components.push({
      type: "MOOD_MATCH",
      value: moodScore,
      reason: `${moodPhrase} — the mood you asked for.`,
    });

    // Alternative phrasings of the same true claim. A list where every line
    // reads "— the mood you asked for" tells the user nothing, and the varier
    // can only choose from claims that are actually earned — so the spares are
    // supplied here rather than invented later.
    const primaryGenre = card.genres?.[0];
    if (primaryGenre) {
      components.push({
        type: "MOOD_MATCH",
        value: moodScore - 0.2,
        reason: `${primaryGenre} with a ${lower(matchedMoods[0] as string)} feel.`,
      });
    }
    if ((card.rating ?? 0) > 0) {
      components.push({
        type: "MOOD_MATCH",
        value: moodScore - 0.3,
        reason: `${moodPhrase.replace(/^./, (c) => c.toUpperCase())}, and rated ${(card.rating ?? 0).toFixed(1)} by the community.`,
      });
    }
  }
  if (similarScore > 0 && ctx.similar) {
    const shared = [...similarGenres, ...similarMoods][0];
    components.push({
      type: "GENRE_MATCH",
      value: similarScore,
      reason: shared
        ? `Shares the ${lower(shared)} side of ${ctx.similar.title}.`
        : `In the same territory as ${ctx.similar.title}.`,
    });
  }
  if (matchedGenres.length > 0) {
    components.push({
      type: "GENRE_MATCH",
      value: genreScore,
      reason: `${matchedGenres.slice(0, 2).join(" and ")} — what you asked for.`,
    });
  }
  if (recentScore > 0) {
    const recentGenre = (card.genres ?? [])
      .filter((g) => (ctx.recentGenreWeights.get(g) ?? 0) > 0)
      .sort((a, b) => (ctx.recentGenreWeights.get(b) ?? 0) - (ctx.recentGenreWeights.get(a) ?? 0))[0];
    if (recentGenre) {
      components.push({
        type: "RECENT_INTEREST",
        value: recentScore,
        reason: `You've been watching ${lower(recentGenre)} lately.`,
      });
    }
  }
  if (tasteScore > 0) {
    const topGenre = (card.genres ?? [])
      .filter((g) => (ctx.genreWeights.get(g) ?? 0) > 0)
      .sort((a, b) => (ctx.genreWeights.get(b) ?? 0) - (ctx.genreWeights.get(a) ?? 0))[0];
    // Prefer naming a specific title the user rated over a generic affinity.
    const liked = topGenre
      ? ctx.likedTitles.find((t) => t.genres.includes(topGenre) && typeof t.score === "number" && t.score >= 4)
      : undefined;
    components.push({
      type: "TASTE_MATCH",
      value: tasteScore,
      reason: liked
        ? `Because you rated ${liked.title} ${liked.score}/5.`
        : topGenre
          ? `You often enjoy ${lower(topGenre)}.`
          : "Matches your usual taste.",
    });
  }
  if (contextScore > 0 && intent.audience) {
    components.push({
      type: "CONTEXT_MATCH",
      value: contextScore,
      reason: `Works well ${AUDIENCE_RULES[intent.audience].label}.`,
    });
  }
  if (runtimeFits && candidate.runtimeMin) {
    components.push({
      type: "RUNTIME_MATCH",
      value: runtimeScore,
      reason: `Runs ${candidate.runtimeMin} minutes — fits the time you have.`,
    });
  }
  if (novelty > 0) {
    components.push({
      type: "EXPLORATION",
      value: novelty,
      reason: "Well reviewed but not widely seen — a step outside your usual picks.",
    });
  }

  components.sort((a, b) => b.value - a.value);
  const winner = components[0];

  return {
    candidate,
    score,
    reasonType: winner?.type ?? "GENRE_MATCH",
    // With no component above zero the only honest claim left is the community's.
    reason: winner?.reason ?? "Highly rated by the Aurora community.",
    alternatives: components,
    tasteBacked: tasteScore > 0 || recentScore > 0 || creatorScore > 0,
  };
}

export function rankCandidates(candidates: MoodCandidate[], ctx: RankContext): ScoredCandidate[] {
  return candidates.map((c) => scoreCandidate(c, ctx)).sort((a, b) => b.score - a.score);
}

/**
 * Takes the final list off the ranked pool while capping how much of it any one
 * genre can occupy (§10, §20).
 *
 * Without the cap, a strong taste signal collapses the list into a single genre
 * and the feature stops being discovery. The cap is a target, not a guarantee:
 * a second pass fills any shortfall rather than returning a short list.
 */
export function diversify(scored: ScoredCandidate[], size: number, maxPerGenre = 3): ScoredCandidate[] {
  const picked: ScoredCandidate[] = [];
  const genreCount = new Map<string, number>();
  const used = new Set<string>();

  for (const item of scored) {
    if (picked.length >= size) break;
    const primary = item.candidate.card.genres?.[0] ?? "__none";
    if ((genreCount.get(primary) ?? 0) >= maxPerGenre) continue;
    picked.push(item);
    used.add(item.candidate.card.id);
    genreCount.set(primary, (genreCount.get(primary) ?? 0) + 1);
  }

  // Shortfall pass: a short list is worse than a slightly less diverse one.
  if (picked.length < size) {
    for (const item of scored) {
      if (picked.length >= size) break;
      if (used.has(item.candidate.card.id)) continue;
      picked.push(item);
      used.add(item.candidate.card.id);
    }
  }

  return picked;
}

/**
 * Varies the wording across a finished list.
 *
 * Ranking picks each title's single strongest justification, which is correct
 * per item but reads mechanically in aggregate — eight titles all saying "the
 * mood you asked for" tells the user nothing and looks generated. This walks
 * the list and, where a reason has already been used, swaps in that item's next
 * strongest claim instead.
 *
 * It only ever selects from claims the item genuinely earned, so varied wording
 * never costs accuracy. If every alternative is taken, the original stands —
 * repeating a true reason beats inventing a fresh one.
 */
export function diversifyReasons(items: ScoredCandidate[]): ScoredCandidate[] {
  const used = new Set<string>();

  return items.map((item) => {
    const options = item.alternatives.length > 0 ? item.alternatives : [];
    const fresh = options.find((option) => !used.has(option.reason));

    if (!fresh) {
      used.add(item.reason);
      return item;
    }

    used.add(fresh.reason);
    return { ...item, reason: fresh.reason, reasonType: fresh.type };
  });
}
