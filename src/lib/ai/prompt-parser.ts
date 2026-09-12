import "server-only";
import { prisma } from "@/lib/db/prisma";

export interface ParsedIntent {
  moods: string[];
  excludedMoods: string[];
  genres: string[];
  excludedGenres: string[];
  kindHint: "movie" | "tv_show" | "music" | null;
  count: number;
}

/**
 * The real mood vocabulary that's actually tagged on Aurora's content
 * (see Movie/TVShow/Album/Song/Artist.moods) plus a few plain-English
 * synonyms people are likely to type. There's no LLM wired into this
 * environment, so natural-language mood requests are parsed by matching
 * against this real, finite vocabulary rather than invented free-form NLP —
 * every match is traceable to a mood value that genuinely exists in the
 * catalog.
 */
const MOOD_SYNONYMS: Record<string, string> = {
  melancholic: "Melancholic",
  sad: "Melancholic",
  atmospheric: "Atmospheric",
  tense: "Tense",
  suspenseful: "Tense",
  dark: "Dark",
  uplifting: "Uplifting",
  happy: "Uplifting",
  feelgood: "Uplifting",
  whimsical: "Whimsical",
  playful: "Whimsical",
  dreamy: "Dreamy",
  intense: "Intense",
  energetic: "Energetic",
  upbeat: "Energetic",
  nostalgic: "Nostalgic",
  calm: "Calm",
  relaxing: "Calm",
  chill: "Calm",
  peaceful: "Calm",
  euphoric: "Euphoric",
  romantic: "Romantic",
  romance: "Romantic",
  comforting: "Comforting",
  cosy: "Comforting",
  cozy: "Comforting",
  "thought-provoking": "Thought-provoking",
  thoughtful: "Thought-provoking",
  cerebral: "Thought-provoking",
  thinky: "Thought-provoking",
};

const KIND_KEYWORDS: { pattern: RegExp; kind: ParsedIntent["kindHint"] }[] = [
  { pattern: /\b(movies?|films?)\b/i, kind: "movie" },
  { pattern: /\b(shows?|series|tv)\b/i, kind: "tv_show" },
  { pattern: /\b(songs?|tracks?|playlists?|music|album)\b/i, kind: "music" },
];

function extractCount(text: string): number {
  const match = text.match(/\b(\d{1,2})\b/);
  const n = match ? Number(match[1]) : 10;
  return Math.min(Math.max(n, 3), 20);
}

/** Splits "X but not Y" / "X without Y" / "not Y" into an included and excluded segment. */
function splitNegation(text: string): { included: string; excluded: string } {
  const match = text.match(/^(.*?)\b(?:but not|without|not)\b(.*)$/i);
  if (!match) return { included: text, excluded: "" };
  return { included: match[1], excluded: match[2] };
}

export async function parsePrompt(promptText: string): Promise<ParsedIntent> {
  const { included, excluded } = splitNegation(promptText);
  const lowerIncluded = included.toLowerCase();
  const lowerExcluded = excluded.toLowerCase();

  const genres = await prisma.genre.findMany({ select: { name: true } });

  const matchMoods = (haystack: string) => {
    const found = new Set<string>();
    for (const [synonym, mood] of Object.entries(MOOD_SYNONYMS)) {
      if (haystack.includes(synonym)) found.add(mood);
    }
    return [...found];
  };
  const matchGenres = (haystack: string) => {
    const found = new Set<string>();
    for (const g of genres) {
      if (haystack.includes(g.name.toLowerCase())) found.add(g.name);
    }
    return [...found];
  };

  const kindMatch = KIND_KEYWORDS.find((k) => k.pattern.test(promptText));

  return {
    moods: matchMoods(lowerIncluded),
    excludedMoods: matchMoods(lowerExcluded),
    genres: matchGenres(lowerIncluded),
    excludedGenres: matchGenres(lowerExcluded),
    kindHint: kindMatch?.kind ?? null,
    count: extractCount(promptText),
  };
}
