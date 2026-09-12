import "server-only";
import { prisma } from "@/lib/db/prisma";

export interface RatingsDistribution {
  total: number;
  /** Index 0 = 1 star ... index 4 = 5 stars. Half-stars round down into their whole-star bucket. */
  buckets: { stars: number; count: number; pct: number }[];
  average: number | null;
}

const MIN_RATINGS_FOR_PATTERN = 5;

/**
 * A real histogram of the user's own rating.score values — not a
 * simulated distribution. Below MIN_RATINGS_FOR_PATTERN ratings, `buckets`
 * is still returned (so the UI can show raw counts) but callers should
 * treat the *pattern* as not yet meaningful.
 */
export async function getRatingsDistribution(userId: string): Promise<RatingsDistribution> {
  const ratings = await prisma.rating.findMany({ where: { userId }, select: { score: true } });
  const total = ratings.length;

  const counts = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const { score } of ratings) {
    const bucket = Math.min(4, Math.max(0, Math.floor(score) - 1));
    counts[bucket]++;
    sum += score;
  }

  const buckets = counts.map((count, i) => ({
    stars: i + 1,
    count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
  }));

  return {
    total,
    buckets,
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
  };
}

export { MIN_RATINGS_FOR_PATTERN };
