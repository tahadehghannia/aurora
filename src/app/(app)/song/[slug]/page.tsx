import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Clock } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getSongBySlug } from "@/lib/content/queries";
import { getUserContentState } from "@/lib/content/user-state";
import { GenreBadges } from "@/components/detail/genre-badges";
import { DetailActions } from "@/components/detail/detail-actions";
import { AddToPlaylistDialog } from "@/components/playlists/add-to-playlist-dialog";
import { CrossMediaSection } from "@/components/content/cross-media-section";
import { getCrossMediaConnections } from "@/lib/crossmedia/discovery";

interface SongPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: SongPageProps): Promise<Metadata> {
  const { slug } = await params;
  const song = await getSongBySlug(slug);
  return { title: song ? `${song.title} · ${song.artist.name}` : "Song" };
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function SongPage({ params }: SongPageProps) {
  const { slug } = await params;
  const song = await getSongBySlug(slug);
  if (!song) notFound();

  const session = await requireSession();
  const userId = session.user.id;
  const [{ saved, userScore }, crossMedia] = await Promise.all([
    getUserContentState(userId, "song", song.id),
    getCrossMediaConnections("song", song.id, userId),
  ]);

  return (
    <div className="flex flex-col gap-10 pb-16">
      <div className="flex flex-col gap-8 px-4 pt-10 sm:flex-row sm:px-8">
        <div className="relative mx-auto h-48 w-48 shrink-0 overflow-hidden rounded-lg shadow-lg sm:mx-0">
          <Image src={song.album?.coverUrl ?? ""} alt="" fill sizes="200px" className="object-cover" />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <Link href={`/artist/${song.artist.slug}`} className="text-body-sm text-ai hover:underline">
              {song.artist.name}
            </Link>
            <h1 className="text-h3 font-bold sm:text-h2">{song.title}</h1>
            <div className="flex flex-wrap items-center justify-center gap-3 text-body-sm text-muted-foreground sm:justify-start">
              {song.album && (
                <Link href={`/album/${song.album.slug}`} className="hover:underline">
                  {song.album.title}
                </Link>
              )}
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {formatDuration(song.durationSec)}
              </span>
              {song.communityRating > 0 && (
                <span className="flex items-center gap-1">
                  <Star size={14} className="fill-rating text-rating" />
                  {song.communityRating.toFixed(1)} ({song.ratingCount.toLocaleString()})
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-center sm:justify-start">
            <GenreBadges genres={song.genres.map((g) => g.name)} />
          </div>

          <DetailActions kind="song" contentId={song.id} title={song.title} initialSaved={saved} initialUserScore={userScore} />

          <div>
            <AddToPlaylistDialog songId={song.id} />
          </div>
        </div>
      </div>

      <div className="sm:px-8">
        <CrossMediaSection result={crossMedia} title="Watch this feeling" />
      </div>
    </div>
  );
}
