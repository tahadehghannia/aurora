import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { movieToCard, showToCard, albumToCard, songToCard } from "@/lib/content/mappers";
import { parsePrompt, type ParsedIntent } from "@/lib/ai/prompt-parser";
import type { ContentCard } from "@/types/content";

export interface MoodDiscoveryResult {
  intent: ParsedIntent;
  items: (ContentCard & { reason: string })[];
}

const GENRE_INCLUDE = { genres: true } as const;

/**
 * Powers "I want something calm tonight" / "a dark movie but not horror"
 * style requests. The prompt is parsed against Aurora's real mood/genre
 * vocabulary (parsePrompt — no LLM available in this environment), then
 * movies, shows, albums and songs are scored by prompt match combined with
 * the user's actual taste signal, exactly like the personalized
 * recommendation engine.
 */
export async function discoverByMood(userId: string, promptText: string, limit = 18): Promise<MoodDiscoveryResult> {
  const [intent, signal] = await Promise.all([parsePrompt(promptText), buildTasteSignal(userId)]);

  const moodFilter = intent.moods.length > 0 ? { moods: { hasSome: intent.moods } } : {};
  const genreFilter = intent.genres.length > 0 ? { genres: { some: { name: { in: intent.genres } } } } : {};
  const excludeGenreFilter =
    intent.excludedGenres.length > 0 ? { genres: { none: { name: { in: intent.excludedGenres } } } } : {};

  const includeMovies = intent.kindHint === null || intent.kindHint === "movie";
  const includeShows = intent.kindHint === null || intent.kindHint === "tv_show";
  const includeMusic = intent.kindHint === null || intent.kindHint === "music";

  const [movies, shows, albums, songs] = await Promise.all([
    includeMovies
      ? prisma.movie.findMany({
          where: { ...moodFilter, ...genreFilter, ...excludeGenreFilter, id: { notIn: [...signal.seen.movieIds] } },
          include: GENRE_INCLUDE,
          take: 40,
          orderBy: { communityRating: "desc" },
        })
      : [],
    includeShows
      ? prisma.tVShow.findMany({
          where: { ...moodFilter, ...genreFilter, ...excludeGenreFilter, id: { notIn: [...signal.seen.showIds] } },
          include: GENRE_INCLUDE,
          take: 40,
          orderBy: { communityRating: "desc" },
        })
      : [],
    includeMusic
      ? prisma.album.findMany({
          where: { ...moodFilter, ...genreFilter, ...excludeGenreFilter, id: { notIn: [...signal.seen.albumIds] } },
          include: { ...GENRE_INCLUDE, artist: true },
          take: 20,
          orderBy: { communityRating: "desc" },
        })
      : [],
    includeMusic
      ? prisma.song.findMany({
          where: { ...moodFilter, ...genreFilter, ...excludeGenreFilter },
          include: { ...GENRE_INCLUDE, artist: true, album: true },
          take: 20,
          orderBy: { communityRating: "desc" },
        })
      : [],
  ]);

  const candidates: ContentCard[] = [
    ...movies.map(movieToCard),
    ...shows.map(showToCard),
    ...albums.map(albumToCard),
    ...songs.map(songToCard),
  ].filter((c) => !c.moods?.some((m) => intent.excludedMoods.includes(m)));

  const scored = candidates.map((card) => {
    const moodMatch = (card.moods ?? []).filter((m) => intent.moods.includes(m)).length;
    const genreMatch = (card.genres ?? []).filter((g) => intent.genres.includes(g)).length;
    const artistBoost = card.artistId ? Math.max(0, signal.artistWeights.get(card.artistId) ?? 0) : 0;
    const tasteScore =
      (card.genres ?? []).reduce((sum, g) => sum + Math.max(0, signal.genreWeights.get(g) ?? 0), 0) +
      (card.moods ?? []).reduce((sum, m) => sum + Math.max(0, signal.moodWeights.get(m) ?? 0), 0) * 0.6 +
      artistBoost;
    const promptMatch = moodMatch * 3 + genreMatch * 2;
    return { card, promptMatch, tasteScore, score: promptMatch * 10 + tasteScore + (card.rating ?? 0) * 0.3 };
  });

  scored.sort((a, b) => b.score - a.score);

  const items = scored.slice(0, limit).map(({ card, promptMatch, tasteScore }) => {
    const matchedMood = (card.moods ?? []).find((m) => intent.moods.includes(m));
    const matchedGenre = (card.genres ?? []).find((g) => intent.genres.includes(g));
    let reason: string;
    if (promptMatch > 0) {
      reason = `${[matchedGenre, matchedMood].filter(Boolean).join(", ")} — what you asked for.`;
    } else if (tasteScore > 0) {
      reason = "Matches your usual taste.";
    } else {
      reason = "Highly rated by the Aurora community.";
    }
    return { ...card, reason };
  });

  return { intent, items };
}
