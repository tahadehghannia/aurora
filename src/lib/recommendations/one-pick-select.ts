import { CONTENT_TYPE_MAP, type ContentCard } from "@/types/content";

/**
 * Pure selection logic for One Perfect Pick, deliberately kept out of the
 * server-only module so it can be unit-tested directly (importing
 * `server-only` throws under Vitest).
 */

export function keyOf(card: ContentCard): string {
  return `${CONTENT_TYPE_MAP[card.kind]}:${card.id}`;
}

/**
 * Chooses the next pick from an already-ranked pool. "Try another" must not
 * be a reroll of the same proposition, so the first preference is the
 * highest-ranked candidate in a primary genre that hasn't been shown yet;
 * only when no such candidate exists does it fall through to next-best.
 */
export function selectNextPick<T extends ContentCard>(pool: T[], excludeKeys: string[]): T | null {
  const excluded = new Set(excludeKeys);
  const remaining = pool.filter((card) => !excluded.has(keyOf(card)));
  if (remaining.length === 0) return null;

  const shownGenres = new Set(
    pool.filter((card) => excluded.has(keyOf(card))).flatMap((card) => card.genres?.slice(0, 1) ?? [])
  );

  const differentGenre = remaining.find((card) => {
    const primary = card.genres?.[0];
    return primary ? !shownGenres.has(primary) : false;
  });

  return differentGenre ?? remaining[0];
}
