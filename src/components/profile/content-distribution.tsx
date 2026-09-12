import type { TasteStats } from "@/lib/taste/stats";

interface ContentDistributionProps {
  stats: TasteStats;
}

const SEGMENTS: { key: keyof Pick<TasteStats, "moviesWatched" | "showsWatched" | "songsListened">; label: string; className: string }[] = [
  { key: "moviesWatched", label: "Movies", className: "bg-brand" },
  { key: "showsWatched", label: "Shows", className: "bg-info" },
  { key: "songsListened", label: "Music", className: "bg-warning" },
];

/** How the user actually spends their entertainment time — a single segmented bar, not a chart for its own sake. */
export function ContentDistribution({ stats }: ContentDistributionProps) {
  const total = stats.moviesWatched + stats.showsWatched + stats.songsListened;
  if (total === 0) return null;

  const segments = SEGMENTS.map((s) => ({ ...s, value: stats[s.key], pct: Math.round((stats[s.key] / total) * 100) })).filter(
    (s) => s.value > 0
  );

  return (
    <div className="space-y-2">
      <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Where your time goes</p>
      <div className="flex h-2 overflow-hidden rounded-full">
        {segments.map((s) => (
          <span key={s.label} className={s.className} style={{ width: `${s.pct}%` }} title={`${s.label}: ${s.pct}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.className}`} />
            {s.label} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}
