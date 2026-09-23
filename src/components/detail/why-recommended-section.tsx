import { Suspense } from "react";
import { whyRecommended, whyRecommendedWithAi } from "@/lib/recommendations/why-this";
import { WhyRecommended } from "@/components/detail/why-recommended";
import type { TasteSignal } from "@/lib/recommendations/signals";
import type { ContentCard } from "@/types/content";

/**
 * "Why this?" on a detail page, without letting the model hold up the page.
 *
 * Aurora's deterministic explanation is computed synchronously and rendered
 * immediately; the AI-worded version streams in to replace it if and when it
 * arrives. Awaiting the model inline — which this did at first — meant a slow
 * or rate-limited provider stalled the entire detail page render, on the most
 * visited surface in the product.
 *
 * The fallback is not a spinner or a skeleton: it is the complete, correct
 * explanation. If the AI never answers, the user loses nothing at all.
 */
export function WhyRecommendedSection({
  card,
  signal,
  userId,
}: {
  card: ContentCard;
  signal: TasteSignal;
  userId: string;
}) {
  const base = whyRecommended(card, signal);
  if (!base.headline) return null;

  return (
    <Suspense fallback={<WhyRecommended whyThis={base} card={card} />}>
      <AiWorded card={card} signal={signal} userId={userId} />
    </Suspense>
  );
}

async function AiWorded({ card, signal, userId }: { card: ContentCard; signal: TasteSignal; userId: string }) {
  const whyThis = await whyRecommendedWithAi(card, signal, userId);
  return <WhyRecommended whyThis={whyThis} card={card} />;
}
