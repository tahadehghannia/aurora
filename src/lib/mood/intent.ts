import { z } from "zod";
import {
  AUDIENCES,
  CATALOG_MOODS,
  EXPLORATION,
  RECENCY,
  isCatalogMood,
  mentions,
  resolveConcepts,
  type MoodConcept,
} from "@/lib/mood/vocabulary";

/**
 * Structured intent extracted from a natural-language mood request (§33).
 *
 * This is the contract between "what the user said" and "what Aurora queries".
 * Both paths that can produce it — the deterministic parser below and the AI
 * service — are validated against this schema, and every mood and genre is
 * checked against Aurora's real vocabulary before a query is built. The model
 * is never trusted to name a tag that exists.
 */

export const contentTypeSchema = z.enum(["movie", "tv_show"]);
export type MoodContentType = z.infer<typeof contentTypeSchema>;

export const moodIntentSchema = z.object({
  /** Concept keys that matched, for explanation copy. */
  concepts: z.array(z.string()).default([]),
  moods: z.array(z.string()).default([]),
  excludeMoods: z.array(z.string()).default([]),
  genres: z.array(z.string()).default([]),
  excludeGenres: z.array(z.string()).default([]),
  /**
   * The subset of excludeGenres/excludeMoods the user actually said out loud.
   * Aurora also vetoes genres a concept can't survive (a "calm" request rules
   * out horror), and those must never be reported back as the user's own words.
   */
  statedExclusions: z.array(z.string()).default([]),
  intensity: z.enum(["low", "medium", "high"]).nullable().default(null),
  /** Hard runtime ceiling in minutes, when the user gave one. */
  runtimeMaxMin: z.number().int().min(20).max(400).nullable().default(null),
  contentTypes: z.array(contentTypeSchema).default([]),
  audience: z.enum(AUDIENCES).nullable().default(null),
  recency: z.enum(RECENCY).default("any"),
  /** A title the user referenced ("like Interstellar"), resolved later. */
  similarTo: z.string().max(100).nullable().default(null),
  keywords: z.array(z.string().max(40)).max(10).default([]),
});

export type MoodIntent = z.infer<typeof moodIntentSchema>;

export const explorationSchema = z.enum(EXPLORATION);

/** Everything the request carries beyond the free-text prompt (§5, §12, §19). */
export const moodRequestSchema = z.object({
  prompt: z.string().trim().min(2).max(400),
  size: z.union([z.literal(5), z.literal(8), z.literal(10), z.literal(12)]).default(8),
  exploration: explorationSchema.default("balanced"),
  /** Optional structured controls; never required (§5). */
  audience: z.enum(AUDIENCES).nullable().default(null),
  runtimeMaxMin: z.number().int().min(20).max(400).nullable().default(null),
  contentType: z.enum(["movie", "tv_show", "any"]).default("any"),
});

export type MoodRequest = z.infer<typeof moodRequestSchema>;

export const EMPTY_INTENT: MoodIntent = moodIntentSchema.parse({});

// --- Free-text extraction ---------------------------------------------------

/**
 * Splits a request into what the user wants and what they're ruling out.
 * Handles the stacked forms people actually type: "dark but not horror",
 * "emotional without being depressing", "funny, nothing childish".
 *
 * Everything after the first exclusion marker is treated as excluded. That is
 * deliberately blunt, but it matches how these requests are actually phrased —
 * the exclusion is nearly always the tail of the sentence.
 */
export function splitExclusions(text: string): { included: string; excluded: string } {
  const marker = /\b(?:but not|but nothing|without being|without|nothing too|nothing|not too|not really|not|avoid|no)\b/i;
  const match = marker.exec(text);
  if (!match) return { included: text, excluded: "" };
  return {
    included: text.slice(0, match.index),
    excluded: text.slice(match.index + match[0].length),
  };
}

/** Word forms people use instead of a digit. */
const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };

function toNumber(token: string): number | null {
  const numeric = Number(token);
  if (!Number.isNaN(numeric)) return numeric;
  return NUMBER_WORDS[token.toLowerCase()] ?? null;
}

function clampRuntime(minutes: number): number | null {
  if (!Number.isFinite(minutes)) return null;
  return Math.min(400, Math.max(20, Math.round(minutes)));
}

/**
 * Pulls a runtime ceiling out of phrases like "90 minutes", "under 2 hours",
 * "a 2-hour flight", "an hour and a half".
 *
 * Ordered most-specific first: the half-hour forms have to be tried before the
 * plain "N hours" pattern, which would otherwise match their prefix and lose
 * the extra thirty minutes.
 */
export function extractRuntime(text: string): number | null {
  const lower = text.toLowerCase();

  const minutes = lower.match(/(\d{2,3})\s*(?:min|mins|minutes)\b/);
  if (minutes?.[1]) return clampRuntime(Number(minutes[1]));

  // "an hour and a half", "two hours and a half"
  const hourThenHalf = lower.match(/(\d+|an?|one|two|three|four)\s*(?:hours?|hrs?)\s*and\s*a\s*half\b/);
  if (hourThenHalf?.[1]) {
    const hours = toNumber(hourThenHalf[1]);
    if (hours !== null) return clampRuntime(hours * 60 + 30);
  }

  // "two and a half hours"
  const halfThenHour = lower.match(/(\d+|an?|one|two|three|four)\s*and\s*a\s*half\s*(?:hours?|hrs?)\b/);
  if (halfThenHour?.[1]) {
    const hours = toNumber(halfThenHour[1]);
    if (hours !== null) return clampRuntime(hours * 60 + 30);
  }

  const hours = lower.match(/(\d+|an?|one|two|three|four)[\s-]*(?:hours?|hrs?)\b/);
  if (hours?.[1]) {
    const value = toNumber(hours[1]);
    if (value !== null) return clampRuntime(value * 60);
  }

  // "something short" is a real constraint even without a number.
  if (mentions(lower, "short") || mentions(lower, "quick")) return 100;
  return null;
}

const AUDIENCE_PATTERNS: { audience: (typeof AUDIENCES)[number]; patterns: RegExp[] }[] = [
  { audience: "family", patterns: [/\bfamily\b/i, /\bwith (?:my )?kids\b/i, /\bchildren\b/i] },
  { audience: "couple", patterns: [/\bpartner\b/i, /\bgirlfriend\b/i, /\bboyfriend\b/i, /\bwife\b/i, /\bhusband\b/i, /\bdate night\b/i, /\bspouse\b/i] },
  { audience: "friends", patterns: [/\bfriends\b/i, /\bgroup\b/i, /\bmates\b/i, /\bwith people\b/i] },
  { audience: "alone", patterns: [/\b(?:by myself|on my own|alone)\b/i] },
];

/** Audience is only ever set from an explicit statement — never inferred (§22). */
export function extractAudience(text: string): (typeof AUDIENCES)[number] | null {
  for (const { audience, patterns } of AUDIENCE_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return audience;
  }
  return null;
}

export function extractRecency(text: string): (typeof RECENCY)[number] {
  const lower = text.toLowerCase();
  if (["new", "recent", "latest", "modern", "this year", "fresh"].some((w) => mentions(lower, w))) return "new";
  if (["classic", "classics", "old", "older", "vintage", "retro"].some((w) => mentions(lower, w))) return "classic";
  return "any";
}

export function extractContentTypes(text: string): MoodContentType[] {
  const lower = text.toLowerCase();
  const wantsMovie = ["movie", "movies", "film", "films"].some((w) => mentions(lower, w));
  const wantsShow = ["show", "shows", "series", "tv", "episode", "episodes"].some((w) => mentions(lower, w));
  if (wantsMovie && !wantsShow) return ["movie"];
  if (wantsShow && !wantsMovie) return ["tv_show"];
  return [];
}

/** Grabs the referenced title from "like Interstellar, but more hopeful". */
export function extractSimilarTo(text: string): string | null {
  const match = text.match(/\b(?:like|similar to|in the vein of|reminds me of)\s+([^,.;]{2,60})/i);
  if (!match?.[1]) return null;
  // Trim trailing qualifiers so "like Interstellar but more hopeful" -> "Interstellar".
  const cleaned = match[1].replace(/\b(?:but|though|however|only|except)\b.*$/i, "").trim();
  return cleaned.length >= 2 ? cleaned : null;
}

function conceptMoods(concepts: MoodConcept[]): string[] {
  return [...new Set(concepts.flatMap((c) => c.moods))];
}

function conceptGenres(concepts: MoodConcept[]): string[] {
  return [...new Set(concepts.flatMap((c) => c.genres ?? []))];
}

/**
 * Deterministic intent extraction.
 *
 * This is not a fallback stub: it is the path Aurora runs when no AI provider
 * is configured, and it produces the same validated MoodIntent shape the AI
 * path does. Every value it emits is drawn from Aurora's real vocabulary.
 */
export function parseMoodIntent(prompt: string, knownGenres: string[]): MoodIntent {
  const { included, excluded } = splitExclusions(prompt);

  const includedConcepts = resolveConcepts(included);
  const excludedConcepts = excluded ? resolveConcepts(excluded) : [];

  const moods = conceptMoods(includedConcepts);
  const genres = new Set(conceptGenres(includedConcepts));

  // Genre names stated outright ("a documentary") outrank concept leanings.
  const lowerIncluded = included.toLowerCase();
  const lowerExcluded = excluded.toLowerCase();
  for (const genre of knownGenres) {
    if (mentions(lowerIncluded, genre.toLowerCase())) genres.add(genre);
  }

  const excludeGenres = new Set<string>();
  // Exclusions the user actually stated — either by naming a genre, or by
  // naming a feeling ("not horror", "nothing depressing").
  const stated = new Set<string>();
  for (const genre of knownGenres) {
    if (excluded && mentions(lowerExcluded, genre.toLowerCase())) {
      excludeGenres.add(genre);
      stated.add(genre);
    }
  }
  for (const concept of excludedConcepts) {
    // The concept's genre cluster is Aurora's expansion of the word, not the
    // word itself: "not horror" also rules out Thriller, which the user never
    // said. Excluded, but never attributed back to them.
    for (const g of concept.genres ?? []) excludeGenres.add(g);
  }
  // Concepts that carry a hard genre veto ("calm" rules out horror). Aurora's
  // inference, not the user's instruction — deliberately not marked as stated.
  for (const concept of includedConcepts) {
    for (const g of concept.avoidGenres ?? []) excludeGenres.add(g);
  }

  // An exclusion must never cancel something the user explicitly asked for:
  // in "emotional but not depressing", both concepts share Emotion-focused,
  // and dropping it would gut the request.
  const excludeMoods = conceptMoods(excludedConcepts).filter((m) => !moods.includes(m));
  for (const g of genres) excludeGenres.delete(g);

  const intensity =
    includedConcepts.find((c) => c.intensity === "high")?.intensity ??
    includedConcepts.find((c) => c.intensity)?.intensity ??
    null;

  return moodIntentSchema.parse({
    concepts: includedConcepts.map((c) => c.key),
    moods,
    excludeMoods,
    genres: [...genres],
    excludeGenres: [...excludeGenres],
    statedExclusions: [...stated].filter((g) => excludeGenres.has(g)),
    intensity,
    runtimeMaxMin: extractRuntime(prompt),
    contentTypes: extractContentTypes(prompt),
    audience: extractAudience(prompt),
    recency: extractRecency(prompt),
    similarTo: extractSimilarTo(prompt),
    keywords: [],
  });
}

/**
 * Drops anything the AI invented, keeping only vocabulary Aurora actually has.
 * Applied to every model-produced intent before it can reach a query (§33).
 */
export function sanitizeIntent(raw: MoodIntent, knownGenres: string[]): MoodIntent {
  const genreSet = new Set(knownGenres.map((g) => g.toLowerCase()));
  const canonicalGenre = (name: string) => knownGenres.find((g) => g.toLowerCase() === name.toLowerCase());

  const keepGenres = (list: string[]) =>
    [...new Set(list.filter((g) => genreSet.has(g.toLowerCase())).map((g) => canonicalGenre(g) ?? g))];
  const keepMoods = (list: string[]) => [...new Set(list.filter(isCatalogMood))];

  const moods = keepMoods(raw.moods);
  const genres = keepGenres(raw.genres);

  return moodIntentSchema.parse({
    ...raw,
    moods,
    genres,
    excludeMoods: keepMoods(raw.excludeMoods).filter((m) => !moods.includes(m)),
    excludeGenres: keepGenres(raw.excludeGenres).filter((g) => !genres.includes(g)),
    statedExclusions: keepGenres(raw.statedExclusions).filter((g) => !genres.includes(g)),
    concepts: raw.concepts.filter((c) => typeof c === "string").slice(0, 8),
    keywords: raw.keywords.slice(0, 10),
  });
}

/** True when nothing usable was extracted — the caller falls back to pure taste. */
export function isEmptyIntent(intent: MoodIntent): boolean {
  return (
    intent.moods.length === 0 &&
    intent.genres.length === 0 &&
    intent.runtimeMaxMin === null &&
    intent.similarTo === null &&
    intent.recency === "any" &&
    intent.contentTypes.length === 0
  );
}

export const CATALOG_MOOD_LIST = [...CATALOG_MOODS];
