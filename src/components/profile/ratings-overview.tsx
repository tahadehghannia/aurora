import type { RatingsDistribution } from "@/lib/taste/ratings-distribution";

const MIN_FOR_PATTERN = 5;

/** A real histogram of the user's own rating.score values — bars, not a fake analytics widget. Below MIN_FOR_PATTERN ratings the pattern isn't meaningful yet, so only the raw average/count show. */
export function RatingsOverview({ distribution }: { distribution: RatingsDistribution }) {
  if (distribution.total === 0) return null;

  const maxCount = Math.max(...distribution.buckets.map((b) => b.count), 1);
  const showPattern = distribution.total >= MIN_FOR_PATTERN;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-6">
      <div className="shrink-0">
        <p className="text-h4 font-semibold text-foreground">{distribution.average?.toFixed(1)}</p>
        <p className="text-caption text-muted-foreground">
          average across {distribution.total} rating{distribution.total === 1 ? "" : "s"}
        </p>
      </div>
      {showPattern && (
        <div className="flex flex-1 items-end gap-2">
          {[...distribution.buckets].reverse().map((b) => (
            <div key={b.stars} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end overflow-hidden rounded-sm bg-muted">
                <div className="w-full rounded-sm bg-rating" style={{ height: `${Math.max(4, (b.count / maxCount) * 100)}%` }} />
              </div>
              <span className="text-caption text-muted-foreground">{b.stars}★</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
