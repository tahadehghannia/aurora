import { ContentRow } from "@/components/content/content-row";
import type { ContentCard } from "@/types/content";

/** Things the user rated/saved recently that fall outside their established genre pattern — "what Aurora helped you find," not just "what's new." */
export function RecentDiscoveries({ items }: { items: ContentCard[] }) {
  if (items.length === 0) return null;

  return (
    <ContentRow
      title="Recent Discoveries"
      subtitle="Outside your usual genres — what Aurora helped you find"
      items={items}
      variant="compact"
    />
  );
}
