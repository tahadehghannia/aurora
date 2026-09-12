import { SectionHeader } from "@/components/content/section-header";
import { ContentCard, ContentCardSkeleton } from "@/components/content/content-card";
import { EmptyRow } from "@/components/states/empty-state";
import type { ContentCard as ContentCardData } from "@/types/content";

interface ContentRowProps {
  title: string;
  subtitle?: string;
  href?: string;
  items: (ContentCardData & { reason?: string })[];
  variant?: "default" | "large" | "compact" | "horizontal";
  emptyMessage?: string;
}

export function ContentRow({ title, subtitle, href, items, variant = "default", emptyMessage }: ContentRowProps) {
  if (items.length === 0 && !emptyMessage) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={title} subtitle={subtitle} href={href} className="px-4 sm:px-0" />
      {items.length === 0 ? (
        <EmptyRow message={emptyMessage ?? "Nothing here yet."} />
      ) : (
        <div className="scroll-fade-x flex gap-4 overflow-x-auto px-4 pb-1 sm:px-0 no-scrollbar">
          {items.map((item) => (
            <ContentCard key={`${item.kind}-${item.id}`} card={item} variant={variant} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ContentRowSkeleton({ variant = "default", count = 6 }: { variant?: ContentRowProps["variant"]; count?: number }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between px-4 sm:px-0">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-4 overflow-x-hidden px-4 sm:px-0">
        {Array.from({ length: count }).map((_, i) => (
          <ContentCardSkeleton key={i} variant={variant} />
        ))}
      </div>
    </section>
  );
}
