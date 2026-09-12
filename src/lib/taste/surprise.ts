import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { movieToCard, showToCard } from "@/lib/content/mappers";
import type { ContentCard } from "@/types/content";

export interface SurpriseDiscovery {
  card: ContentCard;
  reason: string;
}

const GENRE_INCLUDE = { genres: true } as const;

/**
 * "Surprise Me" — something outside the user's strongest genre, but still
 * tied to a mood they genuinely gravitate toward, so it isn't a random
 * pick. Both the comfort-zone genre and the mood cited in the explanation
 * are real weights from the user's own signal; if there's no real mood
 * signal or no matching unexplored content, this returns null rather than
 * fabricating a connection.
 */
export async function getSurpriseDiscovery(userId: string): Promise<SurpriseDiscovery | null> {
  const signal = await buildTasteSignal(userId);
  if (!signal.hasSignal) return null;

  const topGenre = [...signal.genreWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topMood = [...signal.moodWeights.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!topMood) return null;

  // Genres the user has near-zero or no engagement with at all.
  const weakGenres = await prisma.genre.findMany({
    where: { name: { notIn: [...signal.genreWeights.keys()].filter((g) => (signal.genreWeights.get(g) ?? 0) > 0.5) } },
    select: { name: true },
  });
  const weakGenreNames = weakGenres.map((g) => g.name);
  if (weakGenreNames.length === 0) return null;

  const [movies, shows] = await Promise.all([
    prisma.movie.findMany({
      where: {
        moods: { has: topMood },
        genres: { some: { name: { in: weakGenreNames } } },
        id: { notIn: [...signal.seen.movieIds] },
      },
      include: GENRE_INCLUDE,
      orderBy: { communityRating: "desc" },
      take: 5,
    }),
    prisma.tVShow.findMany({
      where: {
        moods: { has: topMood },
        genres: { some: { name: { in: weakGenreNames } } },
        id: { notIn: [...signal.seen.showIds] },
      },
      include: GENRE_INCLUDE,
      orderBy: { communityRating: "desc" },
      take: 5,
    }),
  ]);

  const candidates: ContentCard[] = [...movies.map(movieToCard), ...shows.map(showToCard)];
  if (candidates.length === 0) return null;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const pickGenre = (pick.genres ?? []).find((g) => weakGenreNames.includes(g)) ?? pick.genres?.[0];

  const reason = topGenre
    ? `You usually prefer ${topGenre.toLowerCase()}, but your love of ${topMood.toLowerCase()} stories makes this ${pickGenre?.toLowerCase() ?? "pick"} worth exploring.`
    : `Matches the ${topMood.toLowerCase()} mood you gravitate toward, from outside your usual genres.`;

  return { card: pick, reason };
}
