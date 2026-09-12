import { ContentCard, ContentCardSkeleton } from "@/components/content/content-card";
import type { ContentCard as ContentCardData } from "@/types/content";
import { cn } from "@/lib/utils";

interface ContentGridProps {
  items: (ContentCardData & { reason?: string })[];
  className?: string;
}

export function ContentGrid({ items, className }: ContentGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
        className
      )}
    >
      {items.map((item) => (
        <ContentCard key={`${item.kind}-${item.id}`} card={item} className="w-full" />
      ))}
    </div>
  );
}

export function ContentGridSkeleton({ count = 12, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ContentCardSkeleton key={i} className="w-full" />
      ))}
    </div>
  );
}
