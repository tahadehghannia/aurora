import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PlaylistDetail, type PlaylistTrack } from "@/components/playlists/playlist-detail";

interface PlaylistPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PlaylistPageProps): Promise<Metadata> {
  const { id } = await params;
  const playlist = await prisma.playlist.findUnique({ where: { id }, select: { title: true } });
  return { title: playlist ? `${playlist.title} · Library` : "Playlist" };
}

export default async function PlaylistDetailPage({ params }: PlaylistPageProps) {
  const { id } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const playlist = await prisma.playlist.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { song: { include: { artist: true, album: true } } },
      },
    },
  });

  if (!playlist || (playlist.userId !== userId && !playlist.isPublic)) {
    notFound();
  }

  const tracks: PlaylistTrack[] = playlist.items.map((item) => ({
    songId: item.song.id,
    slug: item.song.slug,
    title: item.song.title,
    artistName: item.song.artist.name,
    artistSlug: item.song.artist.slug,
    albumSlug: item.song.album?.slug ?? null,
    durationSec: item.song.durationSec,
  }));

  return (
    <PlaylistDetail playlistId={playlist.id} title={playlist.title} description={playlist.description} tracks={tracks} />
  );
}
