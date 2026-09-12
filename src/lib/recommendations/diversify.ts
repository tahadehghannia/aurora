import type { ScoredCandidate } from "@/lib/recommendations/hybrid";

export interface DiversityOptions {
  limit: number;
  /** Fraction of the final list reserved for strong-fit picks (default 0.7). */
  strongFitRatio?: number;
  /** Fraction reserved for adjacent, weaker-overlap picks (default 0.2). The remainder goes to exploration. */
  adjacentRatio?: number;
  /** Max items allowed to share the same primary genre, so a Sci-Fi fan doesn't get ten near-identical Sci-Fi picks (default: ~40% of limit). */
  maxPerPrimaryGenre?: number;
}

function primaryGenre(card: ScoredCandidate["card"]): string {
  return card.genres?.[0] ?? `kind:${card.kind}`;
}

/**
 * Re-ranks an already-scored candidate list into a diversity-aware final
 * set: ~70% strong taste fit, ~20% adjacent discovery, ~10% exploration
 * (candidates with little-to-no content-based overlap, riding on popularity
 * alone) — tuned via `contentScore`, the pre-blend content-based component
 * hybrid.ts already computes. A per-genre cap prevents the strong-fit tier
 * itself from turning into ten near-identical picks. Quotas gracefully spill
 * into the next tier when a bucket runs short (a cold-start user has almost
 * nothing in "strong fit" — better to fill the list than under-deliver).
 */
export function diversify(ranked: ScoredCandidate[], options: DiversityOptions): ScoredCandidate[] {
  const { limit, strongFitRatio = 0.7, adjacentRatio = 0.2 } = options;
  const maxPerPrimaryGenre = options.maxPerPrimaryGenre ?? Math.max(2, Math.ceil(limit * 0.4));

  const positiveScores = ranked.map((c) => c.contentScore).filter((s) => s > 0);
  const strongThreshold =
    positiveScores.length > 0 ? [...positiveScores].sort((a, b) => a - b)[Math.floor(positiveScores.length / 2)] : 0;

  const strong = ranked.filter((c) => c.contentScore >= strongThreshold && c.contentScore > 0);
  const adjacent = ranked.filter((c) => c.contentScore > 0 && c.contentScore < strongThreshold);
  const exploration = ranked.filter((c) => c.contentScore <= 0);

  const strongQuota = Math.round(limit * strongFitRatio);
  const adjacentQuota = Math.round(limit * adjacentRatio);
  const explorationQuota = Math.max(0, limit - strongQuota - adjacentQuota);

  const selected: ScoredCandidate[] = [];
  const selectedIds = new Set<string>();
  const genreCounts = new Map<string, number>();

  const take = (pool: ScoredCandidate[], quota: number, enforceCap: boolean) => {
    let taken = 0;
    for (const candidate of pool) {
      if (taken >= quota || selected.length >= limit) break;
      const key = `${candidate.card.kind}:${candidate.card.id}`;
      if (selectedIds.has(key)) continue;
      const genre = primaryGenre(candidate.card);
      if (enforceCap && (genreCounts.get(genre) ?? 0) >= maxPerPrimaryGenre) continue;

      selected.push(candidate);
      selectedIds.add(key);
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      taken++;
    }
    return quota - taken;
  };

  // First pass respects the per-genre cap; leftover quota (either from the
  // cap or a thin bucket) spills to the next tier.
  let spill = take(strong, strongQuota, true);
  spill = take(adjacent, adjacentQuota + spill, true);
  take(exploration, explorationQuota + spill, true);

  // Still short of `limit`? Fill remaining seats from the full ranked list,
  // but keep enforcing the genre cap — otherwise a thin adjacent/exploration
  // bucket would let the cap get silently bypassed by falling through to an
  // uncapped pass, right back to "ten near-identical picks".
  if (selected.length < limit) {
    take(ranked, limit - selected.length, true);
  }
  // Only if there truly aren't enough distinct-enough candidates to fill the
  // list within the cap do we fall back to an uncapped pass — better to
  // return `limit` items than to under-deliver.
  if (selected.length < limit) {
    take(ranked, limit - selected.length, false);
  }

  return selected.sort((a, b) => b.score - a.score);
}
