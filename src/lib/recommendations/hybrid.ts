import type { ContentCard } from "@/types/content";
import { CONTENT_TYPE_MAP } from "@/types/content";
import type { TasteSignal } from "@/lib/recommendations/signals";
import { scoreContentBased } from "@/lib/recommendations/contentBased";
import { scorePopularity } from "@/lib/recommendations/popularity";
import { scoreCollaborative, itemKey, type CollaborativeModel, type ItemKey } from "@/lib/recommendations/collaborative";

export interface ScoredCandidate {
  card: ContentCard;
  score: number;
  /** The raw content-based (genre/mood/creator/artist overlap) component, before blending — used by diversify() to bucket strong-fit vs. adjacent vs. exploration picks. */
  contentScore: number;
  source: "CONTENT_BASED" | "POPULARITY" | "COLLABORATIVE" | "HYBRID";
}

export interface CollaborativeContext {
  model: CollaborativeModel;
  userRatings: { key: ItemKey; score: number }[];
}

/**
 * How much the content-based term should count relative to its cold-start
 * ceiling, keyed by maturity stage (see maturity.ts). A stage-2 user has a
 * handful of ratings — real signal, but thin enough that leaning on it too
 * hard would overfit to a couple of data points. By stage 4-5 there's
 * enough behavior that the taste model can carry most of the weight.
 */
const STAGE_CONTENT_MULTIPLIER: Record<number, number> = {
  1: 0,
  2: 0.55,
  3: 0.8,
  4: 0.95,
  5: 1,
};

/**
 * Blends three signals: content-based affinity, an item-item collaborative
 * score (how this candidate co-rates with things the user already rated,
 * across *all* users), and a popularity/recency prior.
 *
 * Each term degrades gracefully on its own:
 *  - No taste signal yet (new user) → collapses to pure popularity.
 *  - No collaborative data yet (too few cross-user ratings) → scoreCollaborative
 *    returns 0 for every candidate, so that term drops out on its own.
 * This is what keeps cold start and a sparse collaborative dataset from ever
 * producing worse recommendations than content-based + popularity alone.
 */
export function rankCandidates(
  candidates: ContentCard[],
  signal: TasteSignal,
  collaborative?: CollaborativeContext,
  maturityStage: 1 | 2 | 3 | 4 | 5 = 3
): ScoredCandidate[] {
  const hasCollaborative = !!collaborative && collaborative.userRatings.length > 0;
  const stageMultiplier = STAGE_CONTENT_MULTIPLIER[maturityStage] ?? 0.8;

  const contentWeight = signal.hasSignal ? (hasCollaborative ? 0.55 : 0.75) * stageMultiplier : 0;
  const collaborativeWeight = hasCollaborative ? 0.2 : 0;
  const popularityWeight = 1 - contentWeight - collaborativeWeight;

  return candidates
    .map((card) => {
      const contentScore = scoreContentBased(card, signal);
      const popularityScore = scorePopularity(card.popularity ?? 0, card.year);
      const collaborativeScore = hasCollaborative
        ? scoreCollaborative(itemKey(CONTENT_TYPE_MAP[card.kind], card.id), collaborative.userRatings, collaborative.model)
        : 0;

      const blended =
        contentScore * contentWeight +
        collaborativeScore * collaborativeWeight +
        popularityScore * popularityWeight * 4;

      // "Less like this" on this exact item: damp the score proportionately
      // rather than subtracting a flat penalty. A fixed penalty large enough
      // to matter at the top of the distribution buries an item entirely,
      // which is "Not for me" behaviour — and the whole point of this softer
      // action is that the item stays reachable, just ranked lower.
      const isDownranked = signal.softDownranked.has(itemKey(CONTENT_TYPE_MAP[card.kind], card.id));
      const score = isDownranked && blended > 0 ? blended * 0.5 : blended;

      const source: ScoredCandidate["source"] = signal.hasSignal ? "HYBRID" : "POPULARITY";

      return { card, score, contentScore, source };
    })
    .sort((a, b) => b.score - a.score);
}
