import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";

interface PlaylistSummary {
  id: string;
  title: string;
  description: string | null;
  itemCount: number;
  coverImages?: string[];
}

interface PlaylistsPreviewProps {
  playlists: PlaylistSummary[];
  isOwnProfile: boolean;
}

function CoverMosaic({ images }: { images: string[] }) {
  if (images.length === 0) {
    return <div className="aspect-square w-16 shrink-0 rounded-lg bg-muted" />;
  }
  if (images.length === 1) {
    return (
      <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image src={images[0]} alt="" fill sizes="64px" className="object-cover" />
      </div>
    );
  }
  return (
    <div className="grid aspect-square w-16 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-muted">
      {Array.from({ length: 4 }, (_, i) => images[i]).map((src, i) =>
        src ? (
          <div key={i} className="relative">
            <Image src={src} alt="" fill sizes="32px" className="object-cover" />
          </div>
        ) : (
          <div key={i} className="bg-muted" />
        )
      )}
    </div>
  );
}

export function PlaylistsPreview({ playlists, isOwnProfile }: PlaylistsPreviewProps) {
  if (playlists.length === 0 && !isOwnProfile) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h6 font-semibold">Playlists</h2>
        {isOwnProfile && (
          <Link href="/library/playlists" className="text-caption text-muted-foreground hover:text-foreground">
            {playlists.length > 0 ? "View all" : "Create one"} →
          </Link>
        )}
      </div>

      {playlists.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">No playlists yet — build one from any song&apos;s detail page.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => (
            <Link
              key={p.id}
              href={`/library/playlists/${p.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20"
            >
              <CoverMosaic images={p.coverImages ?? []} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{p.title}</p>
                {p.description && <p className="line-clamp-1 text-body-sm text-muted-foreground">{p.description}</p>}
                <p className="mt-1 text-caption text-muted-foreground">
                  {p.itemCount} track{p.itemCount === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          ))}
          {isOwnProfile && (
            <Link
              href="/library/playlists"
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-4 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Plus size={18} />
              <span className="text-body-sm">New playlist</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
