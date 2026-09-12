import type { TasteStats } from "@/lib/taste/stats";

interface TasteStatsSectionProps {
  stats: TasteStats;
}

function StatRow({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="text-body-md font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function TasteStatsSection({ stats }: TasteStatsSectionProps) {
  if (!stats.hasAnyActivity) return null;

  const year = new Date().getFullYear();

  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Your {year} So Far</p>
        {typeof stats.yearOverYearPct === "number" && (
          <span className={stats.yearOverYearPct >= 0 ? "text-caption text-success" : "text-caption text-muted-foreground"}>
            {stats.yearOverYearPct >= 0 ? "+" : ""}
            {stats.yearOverYearPct}% vs. last year
          </span>
        )}
      </div>
      <div>
        <StatRow value={stats.moviesWatched} label="Movies watched" />
        <StatRow value={stats.showsWatched} label="Shows watched" />
        <StatRow value={stats.songsListened.toLocaleString()} label="Songs listened to" />
        <StatRow value={stats.ratingsGiven} label="Ratings given" />
        <StatRow value={stats.genresExplored} label="Genres explored" />
        {stats.topGenre && <StatRow value={stats.topGenre} label="Top genre" />}
        {stats.topMood && <StatRow value={stats.topMood} label="Top mood" />}
        {stats.mostWatchedCreator && <StatRow value={stats.mostWatchedCreator} label="Most watched creator" />}
        {stats.mostListenedArtist && <StatRow value={stats.mostListenedArtist} label="Most listened artist" />}
      </div>
    </section>
  );
}
