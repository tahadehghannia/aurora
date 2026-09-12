import type { EntertainmentDNA } from "@/lib/taste/dna";
import type { TasteStats } from "@/lib/taste/stats";

interface IdentitySnapshotProps {
  dna: EntertainmentDNA;
  stats: TasteStats;
}

/** A few-second read of who this person is, right under the header — before any deeper section. */
export function IdentitySnapshot({ dna, stats }: IdentitySnapshotProps) {
  if (!dna.hasEnoughSignal && !stats.hasAnyActivity) return null;

  const topGenres = dna.favoriteGenres.slice(0, 3).map((g) => g.name);
  const currentMood = dna.favoriteMoods[0]?.name;

  return (
    <div className="flex flex-col gap-3 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        {dna.yourTaste.length > 0 && <p className="text-body-md font-medium text-foreground">{dna.yourTaste.join(" · ")}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
          {topGenres.length > 0 && <span>{topGenres.join(" · ")}</span>}
          {currentMood && (
            <span>
              Currently <span className="text-foreground">{currentMood.toLowerCase()}</span>
            </span>
          )}
        </div>
      </div>

      {stats.hasAnyActivity && (
        <div className="flex gap-5">
          <div>
            <p className="text-h6 font-semibold text-foreground">{stats.moviesWatched}</p>
            <p className="text-caption text-muted-foreground">Movies</p>
          </div>
          <div>
            <p className="text-h6 font-semibold text-foreground">{stats.showsWatched}</p>
            <p className="text-caption text-muted-foreground">Shows</p>
          </div>
          <div>
            <p className="text-h6 font-semibold text-foreground">{stats.songsListened.toLocaleString()}</p>
            <p className="text-caption text-muted-foreground">Songs</p>
          </div>
        </div>
      )}
    </div>
  );
}
