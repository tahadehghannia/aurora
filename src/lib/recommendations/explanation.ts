import type { ContentCard } from "@/types/content";
import type { TasteSignal } from "@/lib/recommendations/signals";
import { buildRecommendationReasons, type CommunityContext, type RecommendationReason } from "@/lib/recommendations/reasons";

/**
 * Plain-string derivations of buildRecommendationReasons (reasons.ts) — the
 * single source of truth for "why was this recommended". Kept as thin
 * wrappers rather than a second copy of the logic, so headline copy and the
 * structured "Why this?" checklist can never drift apart.
 */
export function explainRecommendation(candidate: ContentCard, signal: TasteSignal, community?: CommunityContext): string {
  const reasons = buildRecommendationReasons(candidate, signal, community);
  return reasons[0]?.text ?? "Something a little different from your usual taste — worth a look.";
}

/**
 * The concrete-evidence checklist for the "Why this?" expandable UI —
 * excludes the generic exploration/popularity fallback, since a checklist
 * item implies verifiable evidence, and there simply isn't any for that case.
 */
export function explainRecommendationChecklist(candidate: ContentCard, signal: TasteSignal, community?: CommunityContext): string[] {
  if (!signal.hasSignal) return [];
  return buildRecommendationReasons(candidate, signal, community)
    .filter((r) => r.reasonType !== "EXPLORATION")
    .map((r) => r.text);
}

/** Same checklist, structured — for UI that wants confidence/priority/discoveryHref, not just text. */
export function explainRecommendationDetailed(
  candidate: ContentCard,
  signal: TasteSignal,
  community?: CommunityContext
): RecommendationReason[] {
  if (!signal.hasSignal) return [];
  return buildRecommendationReasons(candidate, signal, community).filter((r) => r.reasonType !== "EXPLORATION");
}
