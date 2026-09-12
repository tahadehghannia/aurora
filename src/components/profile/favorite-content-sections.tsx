import { ContentRow } from "@/components/content/content-row";
import type { FavoriteContent } from "@/lib/taste/favorites";

interface FavoriteContentSectionsProps {
  favorites: FavoriteContent;
}

/** Typed favorites — a poster row per kind, rather than one mixed grid, so each medium reads in its native layout. */
export function FavoriteContentSections({ favorites }: FavoriteContentSectionsProps) {
  const { movies, shows, albums, artists, songs } = favorites;
  const hasAny = movies.length + shows.length + albums.length + artists.length + songs.length > 0;

  if (!hasAny) {
    return (
      <section className="space-y-2">
        <h2 className="text-h6 font-semibold">Favorites</h2>
        <p className="text-body-sm text-muted-foreground">Rate something 4 stars or higher and it&apos;ll show up here.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-h6 font-semibold">Favorites</h2>
      {movies.length > 0 && <ContentRow title="Favorite Movies" items={movies} />}
      {shows.length > 0 && <ContentRow title="Favorite Shows" items={shows} />}
      {albums.length > 0 && <ContentRow title="Favorite Albums" items={albums} variant="compact" />}
      {artists.length > 0 && <ContentRow title="Favorite Artists" items={artists} variant="compact" />}
      {songs.length > 0 && (
        <div className="space-y-2">
          <p className="text-body-sm font-medium text-foreground">Favorite Songs</p>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {songs.map((song) => (
              <div key={song.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">{song.title}</span>
                {song.subtitle && <span className="shrink-0 text-caption text-muted-foreground">{song.subtitle}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
