import type { Metadata } from "next";
import Link from "next/link";
import { ListMusic } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { EmptyState } from "@/components/states/empty-state";
import { CreatePlaylistDialog } from "@/components/playlists/create-playlist-dialog";
import { AiPlaylistDialog } from "@/components/playlists/ai-playlist-dialog";

export const metadata: Metadata = { title: "Playlists · Library" };

export default async function PlaylistsLibraryPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const playlists = await prisma.playlist.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end gap-2">
        <AiPlaylistDialog />
        <CreatePlaylistDialog />
      </div>

      {playlists.length === 0 ? (
        <EmptyState icon={ListMusic} title="No playlists yet" description="Build playlists from any song's detail page." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => (
            <Link
              key={p.id}
              href={`/library/playlists/${p.id}`}
              className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <p className="font-medium">{p.title}</p>
              {p.description && <p className="line-clamp-2 text-body-sm text-muted-foreground">{p.description}</p>}
              <p className="mt-1 text-caption text-muted-foreground">
                {p._count.items} track{p._count.items === 1 ? "" : "s"} · {p.isPublic ? "Public" : "Private"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
