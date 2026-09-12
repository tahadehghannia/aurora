import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { SectionHeader } from "@/components/content/section-header";
import { CONTENT_ROUTE, type ContentCard } from "@/types/content";

interface RankedListProps {
  title: string;
  subtitle?: string;
  items: ContentCard[];
}

/**
 * A compact, editorial "chart" presentation — for sections where the ranking
 * itself is the point (top rated), rather than another poster carousel.
 * Two columns on larger screens so it doesn't stretch into a long scroll.
 */
export function RankedList({ title, subtitle, items }: RankedListProps) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 px-4 sm:px-0">
      <SectionHeader title={title} subtitle={subtitle} />
      <ol className="grid grid-cols-1 gap-x-8 gap-y-0.5 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={`${item.kind}-${item.id}`}>
            <Link
              href={`/${CONTENT_ROUTE[item.kind]}/${item.slug}`}
              className="flex items-center gap-3 rounded-md py-2 pr-2 transition-colors hover:bg-muted/50"
            >
              <span className="w-5 shrink-0 text-right text-body-sm tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
                {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="36px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-foreground">{item.title}</p>
                {item.subtitle && <p className="truncate text-caption text-muted-foreground">{item.subtitle}</p>}
              </div>
              {typeof item.rating === "number" && item.rating > 0 && (
                <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
                  <Star size={11} className="fill-rating text-rating" />
                  {item.rating.toFixed(1)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
