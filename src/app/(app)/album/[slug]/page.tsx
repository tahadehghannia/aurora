import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Clock } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getAlbumBySlug } from "@/lib/content/queries";
import { albumToCard } from "@/lib/content/mappers";
import { getSimilarTo } from "@/lib/recommendations";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { getUserContentState } from "@/lib/content/user-state";
import { GenreBadges } from "@/components/detail/genre-badges";
import { DetailActions } from "@/components/detail/detail-actions";
import { WhyRecommendedSection } from "@/components/detail/why-recommended-section";
import { ContentRow } from "@/components/content/content-row";
import { CrossMediaSection } from "@/components/content/cross-media-section";
import { getCrossMediaConnections } from "@/lib/crossmedia/discovery";

interface AlbumPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AlbumPageProps): Promise<Metadata> {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  return { title: album?.title ?? "Album" };
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  if (!album) notFound();

  const session = await requireSession();
  const userId = session.user.id;

  const [{ saved, userScore }, similar, signal, crossMedia] = await Promise.all([
    getUserContentState(userId, "album", album.id),
    getSimilarTo("album", album.id, 12),
    buildTasteSignal(userId),
    getCrossMediaConnections("album", album.id, userId),
  ]);

  const card = albumToCard(album);

  return (
    <div className="flex flex-col gap-10 pb-16">
      <div className="flex flex-col gap-6 px-4 pt-10 sm:flex-row sm:px-8">
        <div className="relative mx-auto h-48 w-48 shrink-0 overflow-hidden rounded-lg shadow-lg sm:mx-0">
          <Image src={album.coverUrl} alt="" fill sizes="200px" className="object-cover" />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <Link href={`/artist/${album.artist.slug}`} className="text-body-sm text-ai hover:underline">
              {album.artist.name}
            </Link>
            <h1 className="text-h3 font-bold sm:text-h2">{album.title}</h1>
            <div className="flex flex-wrap items-center justify-center gap-3 text-body-sm text-muted-foreground sm:justify-start">
              <span>{album.releaseYear}</span>
              <span>{album.songs.length} tracks</span>
              {album.communityRating > 0 && (
                <span className="flex items-center gap-1">
                  <Star size={14} className="fill-rating text-rating" />
                  {album.communityRating.toFixed(1)} ({album.ratingCount.toLocaleString()})
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-center sm:justify-start">
            <GenreBadges genres={album.genres.map((g) => g.name)} />
          </div>

          <DetailActions kind="album" contentId={album.id} title={album.title} initialSaved={saved} initialUserScore={userScore} />
          <WhyRecommendedSection card={card} signal={signal} userId={userId} />
        </div>
      </div>

      <div className="px-4 sm:px-8">
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {album.songs.map((song, i) => (
            <Link
              key={song.id}
              href={`/song/${song.slug}`}
              className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <span className="w-5 shrink-0 text-body-sm text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{song.title}</span>
              {song.communityRating > 0 && (
                <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
                  <Star size={12} className="fill-rating text-rating" />
                  {song.communityRating.toFixed(1)}
                </span>
              )}
              <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
                <Clock size={12} />
                {formatDuration(song.durationSec)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-10 sm:px-8">
        <ContentRow title="More like this" items={similar} />
        <CrossMediaSection result={crossMedia} title="Beyond the Album" />
      </div>
    </div>
  );
}
