const CURRENT_YEAR = new Date().getFullYear();

/** Scores a candidate on raw popularity (0-100) plus a mild recency boost. */
export function scorePopularity(popularity: number, year?: number): number {
  const recencyBoost = year ? Math.max(0, 1 - (CURRENT_YEAR - year) * 0.08) : 0;
  return popularity / 100 + recencyBoost * 0.5;
}
