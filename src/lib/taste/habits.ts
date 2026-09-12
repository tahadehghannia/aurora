import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal, type TasteSignal } from "@/lib/recommendations/signals";

export interface EntertainmentHabit {
  label: string;
  /** The measured fact behind the label — shown to the user so the trait is never an unexplained assertion. */
  evidence: string;
}

/** Nothing is claimed about a user below this much activity — a habit needs repetition to be a habit. */
const MIN_ACTIVITY = 8;
/** A creator/artist seen this many times in the user's liked titles counts as "returns to". */
const DEEP_DIVE_THRESHOLD = 3;
/** Episodes of one show before "works through a series" is a fair description. */
const BINGE_THRESHOLD = 4;

/**
 * Entertainment Habits — *behavioural* traits, each one a measurement rather
 * than a personality label. Every habit carries the evidence that produced
 * it, and nothing is emitted below MIN_ACTIVITY, so Aurora never tells a
 * near-empty account who it is.
 */
export async function getEntertainmentHabits(userId: string, signal?: TasteSignal): Promise<EntertainmentHabit[]> {
  const taste = signal ?? (await buildTasteSignal(userId));

  const [ratings, episodeWatches, totalWatches, totalListens] = await Promise.all([
    prisma.rating.findMany({ where: { userId }, select: { score: true } }),
    prisma.watchHistory.findMany({ where: { userId, episodeId: { not: null } }, select: { episodeId: true, showId: true } }),
    prisma.watchHistory.count({ where: { userId } }),
    prisma.listeningHistory.count({ where: { userId } }),
  ]);

  const activity = ratings.length + totalWatches + totalListens;
  if (activity < MIN_ACTIVITY) return [];

  const habits: EntertainmentHabit[] = [];

  // Breadth vs. depth — measured from how many distinct genres carry real weight.
  const positiveGenres = [...taste.genreWeights.values()].filter((w) => w > 0).length;
  if (positiveGenres >= 8) {
    habits.push({ label: "Wide-ranging", evidence: `You've engaged with ${positiveGenres} different genres.` });
  } else if (positiveGenres > 0 && positiveGenres <= 3) {
    habits.push({ label: "Focused", evidence: `Most of what you watch and listen to sits in ${positiveGenres} genres.` });
  }

  // Returns to the same creators rather than sampling widely.
  const creatorCounts = new Map<string, number>();
  for (const liked of taste.likedTitles) {
    if (liked.creator) creatorCounts.set(liked.creator, (creatorCounts.get(liked.creator) ?? 0) + 1);
  }
  const topCreator = [...creatorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCreator && topCreator[1] >= DEEP_DIVE_THRESHOLD) {
    habits.push({ label: "Follows creators", evidence: `${topCreator[1]} of your favourites are ${topCreator[0]}'s.` });
  }

  // Works through series rather than sampling single episodes.
  const perShow = new Map<string, number>();
  for (const row of episodeWatches) {
    if (row.showId) perShow.set(row.showId, (perShow.get(row.showId) ?? 0) + 1);
  }
  const deepestShow = Math.max(0, ...perShow.values());
  if (deepestShow >= BINGE_THRESHOLD) {
    habits.push({ label: "Series watcher", evidence: `You've watched ${deepestShow} episodes of one show.` });
  }

  // How they rate — only claimed once there are enough ratings to mean anything.
  if (ratings.length >= 5) {
    const average = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
    if (average >= 4.2) {
      habits.push({ label: "Generous rater", evidence: `Your average rating is ${average.toFixed(1)}/5.` });
    } else if (average <= 3) {
      habits.push({ label: "Hard to please", evidence: `Your average rating is ${average.toFixed(1)}/5.` });
    }
  }

  // Which medium actually dominates their time.
  if (totalListens > totalWatches * 2 && totalListens > 0) {
    habits.push({ label: "Music-first", evidence: `Most of your activity is listening rather than watching.` });
  } else if (totalWatches > totalListens * 2 && totalWatches > 0) {
    habits.push({ label: "Screen-first", evidence: `Most of your activity is watching rather than listening.` });
  }

  return habits.slice(0, 4);
}
