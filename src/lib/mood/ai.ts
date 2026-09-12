import "server-only";
import { z } from "zod";
import { generateStructured, type AiOutcome } from "@/lib/ai/service";
import { MOOD_CURATION_PROMPT_VERSION, MOOD_INTENT_PROMPT_VERSION } from "@/lib/ai/prompts";
import { CATALOG_MOODS } from "@/lib/mood/vocabulary";
import { moodIntentSchema, sanitizeIntent, type MoodIntent } from "@/lib/mood/intent";
import { MOOD_REASON_TYPES, type MoodReasonType, type ScoredCandidate } from "@/lib/mood/rank";

/**
 * The two places a model is allowed to touch a mood watchlist:
 *
 *   1. reading the user's sentence into structured intent, and
 *   2. choosing and wording a final list from candidates Aurora already ranked.
 *
 * It never retrieves, never invents a title, and never decides what exists.
 * Both steps are optional — if the provider is absent or misbehaves, the caller
 * keeps Aurora's own result (§41).
 */

// --- Step 1: intent -------------------------------------------------------

const aiIntentSchema = z.object({
  moods: z.array(z.string()).max(8).default([]),
  excludeMoods: z.array(z.string()).max(8).default([]),
  genres: z.array(z.string()).max(8).default([]),
  excludeGenres: z.array(z.string()).max(8).default([]),
  intensity: z.enum(["low", "medium", "high"]).nullable().default(null),
  runtimeMaxMin: z.number().int().min(20).max(400).nullable().default(null),
  contentTypes: z.array(z.enum(["movie", "tv_show"])).max(2).default([]),
  audience: z.enum(["alone", "friends", "couple", "family"]).nullable().default(null),
  recency: z.enum(["new", "classic", "any"]).default("any"),
  similarTo: z.string().max(100).nullable().default(null),
  keywords: z.array(z.string().max(40)).max(10).default([]),
});

function intentSystemPrompt(genres: string[]): string {
  return [
    "You read a person's description of what they feel like watching and turn it into structured search intent for a film and TV catalogue.",
    "",
    "Rules:",
    `- "moods" and "excludeMoods" MUST come from this exact list: ${CATALOG_MOODS.join(", ")}.`,
    `- "genres" and "excludeGenres" MUST come from this exact list: ${genres.join(", ")}.`,
    "- Never invent a mood or genre that is not on those lists. Omit rather than approximate.",
    "- A feeling usually maps to SEVERAL moods. 'calm' is Calm, Atmospheric, Dreamy and Comforting together, not Calm alone.",
    "- Honour exclusions exactly: 'dark but not horror' excludes the Horror genre, not darkness.",
    "- Never let an exclusion remove something the user explicitly asked for.",
    "- Only set 'audience' if the user actually said who they are watching with. Never infer it.",
    "- Only set 'runtimeMaxMin' if they stated a time limit. Never guess a runtime.",
    "- 'similarTo' is a title they referenced, with no qualifiers: 'like Interstellar but more hopeful' gives 'Interstellar'.",
    "",
    "Respond with JSON only, matching this shape:",
    '{"moods":[],"excludeMoods":[],"genres":[],"excludeGenres":[],"intensity":null,"runtimeMaxMin":null,"contentTypes":[],"audience":null,"recency":"any","similarTo":null,"keywords":[]}',
  ].join("\n");
}

/** Reads a request into structured intent. Everything is re-validated after (§33). */
export async function interpretMoodWithAi(prompt: string, knownGenres: string[]): Promise<AiOutcome<MoodIntent>> {
  const outcome = await generateStructured({
    task: "mood.intent",
    promptVersion: MOOD_INTENT_PROMPT_VERSION,
    system: intentSystemPrompt(knownGenres),
    user: prompt,
    schema: aiIntentSchema,
    // Same reasoning-token headroom as curation below: the visible JSON here is
    // tiny, but a reasoning model burns budget before emitting any of it.
    maxTokens: 900,
    timeoutMs: 8_000,
  });

  if (!outcome.ok) return outcome;

  // The model's output is a suggestion; the vocabulary check is the authority.
  const sanitized = sanitizeIntent(moodIntentSchema.parse({ ...outcome.data, concepts: [] }), knownGenres);
  return { ok: true, data: sanitized, provider: outcome.provider, model: outcome.model };
}

// --- Step 2: curation -----------------------------------------------------

const aiCurationSchema = z.object({
  title: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(240),
  whyThisList: z.string().trim().max(320).default(""),
  items: z
    .array(
      z.object({
        contentId: z.string().min(1),
        reason: z.string().trim().min(2).max(180),
        reasonType: z.string(),
      })
    )
    .min(1)
    .max(20),
});

const CURATION_SYSTEM = [
  "You are the curation step inside Aurora, an entertainment discovery product. You are given a ranked shortlist of real titles and a description of one person's taste and current mood.",
  "",
  "Your job is to choose the final watchlist, order it, name it, and say why each title is there.",
  "",
  "Hard rules:",
  "- Choose ONLY from the supplied candidates. Use their contentId values verbatim.",
  "- Never invent, rename, or describe a title that is not in the list. If you are unsure a film exists, it is not your concern — only the list matters.",
  "- Every reason must be supported by the evidence supplied for that candidate or by the user's stated request. Never claim the user loves something the evidence does not show.",
  "- Honour every exclusion in the request absolutely.",
  "- Keep genuine variety; do not fill the list with one genre.",
  "- Reasons are one short sentence, concrete, no marketing language.",
  "- The title is quiet and editorial, like a shelf in a good video shop: 'Rainy Night Cinema', 'Quiet Things to Watch', 'After Hours'. Never clickbait, never a question, never the word 'AI'.",
  `- reasonType must be one of: ${MOOD_REASON_TYPES.join(", ")}.`,
  "",
  'Respond with JSON only: {"title":"...","description":"...","whyThisList":"...","items":[{"contentId":"...","reason":"...","reasonType":"MOOD_MATCH"}]}',
].join("\n");

export interface CurationEvidence {
  prompt: string;
  intentSummary: string;
  /** Compact, real taste facts — never the full library (§9). */
  tasteSummary: string[];
  exploration: string;
  size: number;
}

export interface CuratedList {
  title: string;
  description: string;
  whyThisList: string;
  items: { contentId: string; reason: string; reasonType: MoodReasonType }[];
}

/** Compact candidate metadata — ids plus the few fields curation actually needs. */
function serializeCandidates(ranked: ScoredCandidate[]): string {
  return ranked
    .map((item) => {
      const { card } = item.candidate;
      const parts = [
        `id=${card.id}`,
        `title=${card.title}`,
        `year=${item.candidate.year}`,
        `type=${card.kind}`,
        `genres=${(card.genres ?? []).slice(0, 3).join("/") || "-"}`,
        `moods=${(card.moods ?? []).slice(0, 3).join("/") || "-"}`,
        item.candidate.runtimeMin ? `runtime=${item.candidate.runtimeMin}m` : "runtime=unknown",
        `rating=${(card.rating ?? 0).toFixed(1)}`,
        `auroraEvidence="${item.reason}"`,
      ];
      return parts.join(" ");
    })
    .join("\n");
}

function isReasonType(value: string): value is MoodReasonType {
  return (MOOD_REASON_TYPES as string[]).includes(value);
}

/**
 * Asks the model to curate the final list from the ranked shortlist.
 *
 * Returns a failure outcome — never a partial list — if the model picks ids
 * that aren't real. Half the list surviving validation is treated as a broken
 * response rather than something to patch up, because a model inventing ids is
 * evidence the whole response is untrustworthy.
 */
export async function curateWithAi(
  ranked: ScoredCandidate[],
  evidence: CurationEvidence
): Promise<AiOutcome<CuratedList>> {
  // Send a shortlist, not the pool: the model's job is selection among strong
  // options, and a smaller payload is faster and cheaper.
  const shortlist = ranked.slice(0, Math.max(evidence.size * 3, 24));
  const allowed = new Map(shortlist.map((item) => [item.candidate.card.id, item]));

  const user = [
    `The person asked for: "${evidence.prompt}"`,
    `Aurora read that as: ${evidence.intentSummary}`,
    evidence.tasteSummary.length > 0
      ? `What Aurora knows about their taste:\n- ${evidence.tasteSummary.join("\n- ")}`
      : "Aurora has very little taste history for this person yet, so do not claim to know their taste.",
    `Exploration setting: ${evidence.exploration}`,
    "",
    `Choose exactly ${evidence.size} of these candidates:`,
    serializeCandidates(shortlist),
  ].join("\n");

  const outcome = await generateStructured({
    task: "mood.curate",
    promptVersion: MOOD_CURATION_PROMPT_VERSION,
    system: CURATION_SYSTEM,
    user,
    schema: aiCurationSchema,
    // Reasoning models (Groq's gpt-oss line among them) spend part of this
    // budget on hidden reasoning tokens before emitting a single character of
    // JSON. A cap sized only for the visible output truncates the object and
    // the whole response gets discarded as unparseable, so there is deliberate
    // headroom here. Unused budget costs nothing — billing is on actual tokens.
    maxTokens: 2400,
    timeoutMs: 15_000,
  });

  if (!outcome.ok) return outcome;

  const seen = new Set<string>();
  const items = outcome.data.items
    .filter((item) => {
      if (!allowed.has(item.contentId) || seen.has(item.contentId)) return false;
      seen.add(item.contentId);
      return true;
    })
    .map((item) => ({
      contentId: item.contentId,
      reason: item.reason,
      // An unrecognized reasonType falls back to Aurora's own classification
      // rather than being stored as an unknown value.
      reasonType: isReasonType(item.reasonType)
        ? item.reasonType
        : (allowed.get(item.contentId)?.reasonType ?? "GENRE_MATCH"),
    }));

  // A model that hallucinated most of its ids is not a model to trust for copy.
  if (items.length < Math.min(evidence.size, 3) || items.length < outcome.data.items.length / 2) {
    return { ok: false, reason: "invalid_output" };
  }

  return {
    ok: true,
    data: {
      title: outcome.data.title,
      description: outcome.data.description,
      whyThisList: outcome.data.whyThisList,
      items,
    },
    provider: outcome.provider,
    model: outcome.model,
  };
}
