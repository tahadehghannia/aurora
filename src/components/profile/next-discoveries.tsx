import { ContentRow } from "@/components/content/content-row";
import { SurpriseMe } from "@/components/profile/surprise-me";
import type { RecommendedCard } from "@/types/content";

interface NextDiscoveriesProps {
  items: RecommendedCard[];
}

/** Secondary by design — Profile is about identity first, recommendations second. */
export function NextDiscoveries({ items }: NextDiscoveriesProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <ContentRow title="Your Next Discoveries" subtitle="Based on your recent taste" items={items} variant="compact" />
      <SurpriseMe />
    </section>
  );
}
