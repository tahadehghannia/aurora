import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { CONTENT_ROUTE } from "@/types/content";
import type { ContentCard } from "@/types/content";

export type RatingsSort = "newest" | "highest" | "lowest";

interface RatedItem {
  card: ContentCard;
  score: number;
  ratedAt: Date;
}

interface RatingsSectionProps {
  items: RatedItem[];
  sort: RatingsSort;
  total: number;
}

const SORT_OPTIONS: { value: RatingsSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export function RatingsSection({ items, sort, total }: RatingsSectionProps) {
  if (total === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-h6 font-semibold">Ratings</h2>
        <p className="text-body-sm text-muted-foreground">Nothing rated yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h6 font-semibold">Ratings</h2>
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={`/profile?ratingsSort=${opt.value}#ratings`}
              scroll={false}
              className={`rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
                sort === opt.value ? "bg-surface-active text-brand" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {items.map(({ card, score, ratedAt }) => (
          <Link
            key={`${card.kind}-${card.id}`}
            href={`/${CONTENT_ROUTE[card.kind]}/${card.slug}`}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
              {card.imageUrl && <Image src={card.imageUrl} alt="" fill sizes="36px" className="object-cover" />}
            </div>
            <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">{card.title}</span>
            <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
              <Star size={12} className="fill-rating text-rating" />
              {score.toFixed(1)}
            </span>
            <span className="hidden shrink-0 text-caption text-muted-foreground sm:inline">
              {ratedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </Link>
        ))}
      </div>

      {total > items.length && (
        <Link href="/library/ratings" className="text-caption text-muted-foreground hover:text-foreground">
          View all {total} ratings →
        </Link>
      )}
    </section>
  );
}
