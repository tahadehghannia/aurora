import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getEntertainmentDNA } from "@/lib/taste/dna";
import { buildTasteSignal } from "@/lib/recommendations/signals";

export interface TasteStats {
  hasAnyActivity: boolean;
  moviesWatched: number;
  showsWatched: number;
  songsListened: number;
  ratingsGiven: number;
  genresExplored: number;
  topGenre: string | null;
  topMood: string | null;
  mostWatchedCreator: string | null;
  mostListenedArtist: string | null;
  /** % change in discovery activity (ratings+saves+watches+listens) vs. the prior 365 days — null unless both windows have enough rows for a percentage to mean anything. */
  yearOverYearPct: number | null;
}

const MIN_ROWS_FOR_YOY = 5;

/**
 * Every number here is a direct count/aggregate over the user's own rows —
 * no estimation, no vanity metrics. A field is null, not guessed, when there
 * isn't enough data to name a "top" anything.
 */
export async function getTasteStats(userId: string): Promise<TasteStats> {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setDate(twoYearsAgo.getDate() - 730);

  const signal = await buildTasteSignal(userId);
  const [dna, moviesWatched, showsWatched, songsListened, ratingsGiven, recentActivity, priorActivity] = await Promise.all([
    getEntertainmentDNA(userId, signal),
    prisma.watchHistory.findMany({ where: { userId, movieId: { not: null } }, distinct: ["movieId"], select: { movieId: true } }),
    prisma.watchHistory.findMany({ where: { userId, showId: { not: null } }, distinct: ["showId"], select: { showId: true } }),
    prisma.listeningHistory.count({ where: { userId } }),
    prisma.rating.count({ where: { userId } }),
    countActivity(userId, oneYearAgo, now),
    countActivity(userId, twoYearsAgo, oneYearAgo),
  ]);

  const genresExplored = signal.genreWeights.size;
  const hasAnyActivity =
    moviesWatched.length > 0 || showsWatched.length > 0 || songsListened > 0 || ratingsGiven > 0 || signal.hasSignal;

  const yearOverYearPct =
    recentActivity >= MIN_ROWS_FOR_YOY && priorActivity >= MIN_ROWS_FOR_YOY
      ? Math.round(((recentActivity - priorActivity) / priorActivity) * 100)
      : null;

  return {
    hasAnyActivity,
    moviesWatched: moviesWatched.length,
    showsWatched: showsWatched.length,
    songsListened,
    ratingsGiven,
    genresExplored,
    topGenre: dna.favoriteGenres[0]?.name ?? null,
    topMood: dna.favoriteMoods[0]?.name ?? null,
    mostWatchedCreator: dna.favoriteCreators[0]?.name ?? null,
    mostListenedArtist: dna.favoriteArtists[0]?.name ?? null,
    yearOverYearPct,
  };
}

async function countActivity(userId: string, from: Date, to: Date): Promise<number> {
  const [ratings, saved, watched, listened] = await Promise.all([
    prisma.rating.count({ where: { userId, createdAt: { gte: from, lt: to } } }),
    prisma.savedItem.count({ where: { userId, createdAt: { gte: from, lt: to } } }),
    prisma.watchHistory.count({ where: { userId, watchedAt: { gte: from, lt: to } } }),
    prisma.listeningHistory.count({ where: { userId, playedAt: { gte: from, lt: to } } }),
  ]);
  return ratings + saved + watched + listened;
}
