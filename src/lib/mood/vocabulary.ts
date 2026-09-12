/**
 * The closed vocabulary every mood request is resolved against.
 *
 * This file is pure data and pure functions — no database, no server-only —
 * so the ranking logic built on it stays unit-testable.
 *
 * The single most important design fact here: a user's *feeling* is not a
 * catalog tag. Aurora's catalog tags "Calm" on exactly one title, but "I want
 * something calm tonight" is the canonical request this feature exists to
 * answer. So a feeling resolves to a CONCEPT — a cluster of real tags and genre
 * leanings that together have enough content behind them to rank. Mapping
 * "calm" one-to-one onto the Calm tag would return an almost empty list.
 */

/** Mood tags that genuinely exist on Aurora's movies and shows, by frequency. */
export const CATALOG_MOODS = [
  "Thought-provoking",
  "Uplifting",
  "Energetic",
  "Whimsical",
  "Melancholic",
  "Intense",
  "Tense",
  "Comforting",
  "Dark",
  "Atmospheric",
  "Dreamy",
  "Romantic",
  "Nostalgic",
  "Emotion-focused",
  "Calm",
] as const;

export type CatalogMood = (typeof CATALOG_MOODS)[number];

const CATALOG_MOOD_SET: ReadonlySet<string> = new Set(CATALOG_MOODS);

export function isCatalogMood(value: string): value is CatalogMood {
  return CATALOG_MOOD_SET.has(value);
}

export interface MoodConcept {
  /** Stable key, used in stored intent and in titles. */
  key: string;
  /** How Aurora words this back to the user. */
  label: string;
  /** Words and phrases that trigger the concept. Matched on word boundaries. */
  synonyms: string[];
  /** Real catalog mood tags this feeling maps onto. */
  moods: CatalogMood[];
  /** Genres that tend to carry the feeling. */
  genres?: string[];
  /** Genres that almost always break the feeling. */
  avoidGenres?: string[];
  intensity?: "low" | "medium" | "high";
}

/**
 * Concepts are ordered most-specific-first so that "not too sad" resolves
 * against `sad` before the looser `emotional` picks up the same words.
 */
export const MOOD_CONCEPTS: MoodConcept[] = [
  {
    key: "calm",
    label: "Calm",
    synonyms: ["calm", "calming", "relaxing", "relaxed", "chill", "peaceful", "quiet", "gentle", "soothing", "unwind", "slow"],
    moods: ["Calm", "Atmospheric", "Dreamy", "Comforting"],
    genres: ["Drama", "Documentary", "Animation"],
    avoidGenres: ["Horror", "Action"],
    intensity: "low",
  },
  {
    key: "comforting",
    label: "Comforting",
    synonyms: ["comforting", "comfort", "cozy", "cosy", "warm", "wholesome", "feel good", "feelgood", "familiar", "easy watch", "easy to watch"],
    moods: ["Comforting", "Uplifting", "Whimsical"],
    genres: ["Comedy", "Family", "Animation", "Romance"],
    avoidGenres: ["Horror"],
    intensity: "low",
  },
  {
    key: "uplifting",
    label: "Uplifting",
    synonyms: ["uplifting", "happy", "hopeful", "joyful", "optimistic", "heartwarming", "positive", "cheerful"],
    moods: ["Uplifting", "Comforting"],
    genres: ["Comedy", "Family", "Adventure"],
    avoidGenres: ["Horror"],
    intensity: "low",
  },
  {
    key: "funny",
    label: "Funny",
    synonyms: ["funny", "comedy", "laugh", "hilarious", "humour", "humor", "silly", "lighthearted", "light-hearted", "light"],
    moods: ["Whimsical", "Uplifting", "Energetic"],
    genres: ["Comedy", "Animation"],
    avoidGenres: ["Horror"],
    intensity: "low",
  },
  {
    key: "dark",
    label: "Dark",
    synonyms: ["dark", "grim", "bleak", "gritty", "brutal", "sinister", "twisted", "noir"],
    moods: ["Dark", "Tense", "Melancholic"],
    genres: ["Thriller", "Crime", "Mystery", "Drama"],
    intensity: "high",
  },
  {
    key: "tense",
    label: "Tense",
    synonyms: ["tense", "tension", "suspense", "suspenseful", "thriller", "thrilling", "edge of my seat", "gripping", "nail-biting"],
    moods: ["Tense", "Intense"],
    genres: ["Thriller", "Mystery", "Crime"],
    intensity: "high",
  },
  {
    key: "scary",
    label: "Scary",
    synonyms: ["scary", "horror", "frightening", "terrifying", "creepy", "spooky", "haunting"],
    moods: ["Tense", "Dark", "Intense"],
    genres: ["Horror", "Thriller"],
    intensity: "high",
  },
  {
    key: "sad",
    label: "Moving",
    synonyms: ["sad", "cry", "crying", "tearjerker", "heartbreaking", "devastating", "depressing", "melancholy", "melancholic", "bittersweet", "sorrowful"],
    moods: ["Melancholic", "Emotion-focused"],
    genres: ["Drama", "Romance"],
    intensity: "medium",
  },
  {
    key: "emotional",
    label: "Emotional",
    synonyms: ["emotional", "moving", "touching", "poignant", "affecting", "heartfelt", "human"],
    moods: ["Emotion-focused", "Melancholic", "Romantic", "Comforting"],
    genres: ["Drama", "Romance"],
    intensity: "medium",
  },
  {
    key: "romantic",
    label: "Romantic",
    synonyms: ["romantic", "romance", "love story", "love", "date night"],
    moods: ["Romantic", "Emotion-focused"],
    genres: ["Romance", "Drama"],
    intensity: "low",
  },
  {
    key: "thoughtful",
    label: "Thought-provoking",
    synonyms: ["thoughtful", "thought provoking", "thought-provoking", "smart", "clever", "cerebral", "intelligent", "philosophical", "mind bending", "mind-bending", "mindbending", "complex", "deep", "makes you think"],
    moods: ["Thought-provoking"],
    genres: ["Sci-Fi", "Drama", "Mystery", "Documentary"],
    intensity: "medium",
  },
  {
    key: "atmospheric",
    label: "Atmospheric",
    synonyms: ["atmospheric", "moody", "immersive", "ambient", "meditative", "beautiful", "gorgeous", "stunning", "visual", "soundtrack", "cinematic"],
    moods: ["Atmospheric", "Dreamy"],
    genres: ["Drama", "Sci-Fi", "Fantasy"],
    intensity: "low",
  },
  {
    key: "dreamy",
    label: "Dreamlike",
    synonyms: ["dreamy", "dreamlike", "surreal", "strange", "weird", "trippy", "abstract"],
    moods: ["Dreamy", "Whimsical", "Atmospheric"],
    genres: ["Fantasy", "Sci-Fi"],
    intensity: "medium",
  },
  {
    key: "energetic",
    label: "Energetic",
    synonyms: ["energetic", "exciting", "fun", "action", "adrenaline", "fast", "fast-paced", "wild", "popcorn", "blockbuster"],
    moods: ["Energetic", "Intense"],
    genres: ["Action", "Adventure", "Thriller"],
    intensity: "high",
  },
  {
    key: "epic",
    label: "Epic",
    synonyms: ["epic", "grand", "sweeping", "spectacle", "adventure", "journey"],
    moods: ["Energetic", "Intense", "Atmospheric"],
    genres: ["Adventure", "Fantasy", "Action", "History"],
    intensity: "high",
  },
  {
    key: "nostalgic",
    label: "Nostalgic",
    synonyms: ["nostalgic", "nostalgia", "childhood", "retro", "throwback"],
    moods: ["Nostalgic", "Comforting"],
    genres: ["Animation", "Family", "Adventure"],
    intensity: "low",
  },
];

/** Audience context — only ever set from what the user explicitly said (§22). */
export const AUDIENCES = ["alone", "friends", "couple", "family"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_RULES: Record<
  Audience,
  { label: string; favorGenres: string[]; avoidGenres: string[]; avoidMoods: CatalogMood[] }
> = {
  alone: { label: "on your own", favorGenres: [], avoidGenres: [], avoidMoods: [] },
  friends: { label: "with friends", favorGenres: ["Comedy", "Action", "Adventure", "Horror"], avoidGenres: [], avoidMoods: ["Melancholic"] },
  couple: { label: "with your partner", favorGenres: ["Romance", "Drama", "Comedy"], avoidGenres: [], avoidMoods: [] },
  // The only audience that implies a hard content constraint rather than a lean.
  family: { label: "with family", favorGenres: ["Animation", "Family", "Adventure", "Comedy"], avoidGenres: ["Horror"], avoidMoods: ["Dark", "Intense"] },
};

export const RECENCY = ["new", "classic", "any"] as const;
export type Recency = (typeof RECENCY)[number];

export const EXPLORATION = ["close", "balanced", "surprise"] as const;
export type Exploration = (typeof EXPLORATION)[number];

export const EXPLORATION_LABEL: Record<Exploration, string> = {
  close: "Stay close to my taste",
  balanced: "Balanced",
  surprise: "Surprise me",
};

/** Matches a synonym as a whole word/phrase, so "light" never fires inside "delightful". */
export function mentions(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

/** Every concept whose synonyms appear in `text`. */
export function resolveConcepts(text: string): MoodConcept[] {
  const lower = text.toLowerCase();
  return MOOD_CONCEPTS.filter((concept) => concept.synonyms.some((s) => mentions(lower, s)));
}
