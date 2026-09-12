import "server-only";
import type { TasteSignal } from "@/lib/recommendations/signals";
import { buildRecommendationReasons, type CommunityContext, type RecommendationReason } from "@/lib/recommendations/reasons";
import { explainRecommendation } from "@/lib/recommendations/explain-ai";
import type { ContentCard } from "@/types/content";

export interface WhyThis {
  headline: string | null;
  /** True when the headline was worded by a model rather than templated (§30). */
  headlineAiGenerated?: boolean;
  checklist: string[];
  /** Same checklist, structured — confidence/priority/discoveryHref for UI that wants more than plain text. */
  reasons: RecommendationReason[];
}

/**
 * A per-item "why this" line + expandable checklist for detail pages —
 * built directly on the same structured reason engine (reasons.ts) as the
 * recommendation rails. Filters by `reasonType`, not by matching literal
 * fallback strings, so it stays correct if the fallback copy ever changes.
 * Returns null/empty when the only thing available is the generic
 * exploration/popularity fallback — a "why this" line that says nothing
 * concrete isn't worth showing.
 */
export function whyRecommended(card: ContentCard, signal: TasteSignal, community?: CommunityContext): WhyThis {
  if (!signal.hasSignal) return { headline: null, checklist: [], reasons: [] };

  const all = buildRecommendationReasons(card, signal, community);
  const concrete = all.filter((r) => r.reasonType !== "EXPLORATION");

  return {
    headline: concrete[0]?.text ?? null,
    checklist: concrete.map((r) => r.text),
    reasons: concrete,
  };
}

/**
 * The same explanation, with the headline reworded by a model when one is
 * available (§10, §11).
 *
 * Aurora's structured reasons are computed first and passed in; the model only
 * ever rewrites the top line. The checklist underneath stays exactly as Aurora
 * generated it, so the evidence a user can expand and check is never
 * model-written.
 */
export async function whyRecommendedWithAi(
  card: ContentCard,
  signal: TasteSignal,
  userId: string,
  community?: CommunityContext
): Promise<WhyThis> {
  const base = whyRecommended(card, signal, community);
  if (!base.headline) return base;

  const explanation = await explainRecommendation(card, base.reasons, userId);
  if (!explanation) return base;

  return { ...base, headline: explanation, headlineAiGenerated: true };
}
