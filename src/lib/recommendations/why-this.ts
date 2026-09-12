import "server-only";
import type { TasteSignal } from "@/lib/recommendations/signals";
import { buildRecommendationReasons, type CommunityContext, type RecommendationReason } from "@/lib/recommendations/reasons";
import type { ContentCard } from "@/types/content";

export interface WhyThis {
  headline: string | null;
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
