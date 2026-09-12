import "server-only";
import { getRecommendationsForUser } from "@/lib/recommendations";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { buildRecommendationReasons, type RecommendationReason } from "@/lib/recommendations/reasons";
import { keyOf, selectNextPick } from "@/lib/recommendations/one-pick-select";
import type { ContentCard } from "@/types/content";

export interface OnePick {
  card: ContentCard;
  /** Grounded reasons from the same engine that powers "Why this?" everywhere else. */
  reasons: RecommendationReason[];
  /** The mood this pick speaks to, when the user has a real mood signal. */
  moodContext: string | null;
  /** Up to two titles the user actually rated highly that anchor this pick. */
  likedAnchors: string[];
  /** Opaque keys of everything shown so far — pass back to "Try another". */
  shownKeys: string[];
}

/** How deep into the ranked list one pick is allowed to look before giving up. */
const POOL_SIZE = 24;

/**
 * One highly-relevant recommendation instead of a wall of options — the
 * antidote to choice paralysis.
 *
 * It reuses the full personalization pipeline (taste signal → hybrid ranking
 * → diversity → explanation) rather than re-deriving anything, so the single
 * pick is exactly as personalized as the main rails — never "the most
 * popular thing", which is the failure mode this feature exists to avoid.
 *
 * "Try another" is not a reroll: `exclude` carries the keys already shown and
 * selectNextPick constrains the next suggestion to a different primary genre
 * where possible (see one-pick-select.ts).
 */
export async function getOnePerfectPick(userId: string, exclude: string[] = []): Promise<OnePick | null> {
  const [pool, signal] = await Promise.all([
    getRecommendationsForUser(userId, { limit: POOL_SIZE, recommendationType: "TONIGHT", persist: false }),
    buildTasteSignal(userId),
  ]);
  if (pool.length === 0) return null;

  const chosen = selectNextPick(pool, exclude);
  if (!chosen) return null;

  const likedAnchors = signal.likedTitles
    .filter((liked) => typeof liked.score === "number" && liked.score >= 4)
    .map((liked) => liked.title)
    .slice(0, 2);

  const topMood = [...signal.moodWeights.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    card: chosen,
    reasons: buildRecommendationReasons(chosen, signal).filter((r) => r.reasonType !== "EXPLORATION"),
    moodContext: topMood ?? null,
    likedAnchors,
    shownKeys: [...exclude, keyOf(chosen)],
  };
}
