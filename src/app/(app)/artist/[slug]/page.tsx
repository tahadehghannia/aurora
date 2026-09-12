import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getArtistBySlug } from "@/lib/content/queries";
import { albumToCard, songToCard } from "@/lib/content/mappers";
import { getUserContentState } from "@/lib/content/user-state";
import { GenreBadges } from "@/components/detail/genre-badges";
import { DetailActions } from "@/components/detail/detail-actions";
import { ContentRow } from "@/components/content/content-row";
import { CrossMediaSection } from "@/components/content/cross-media-section";
import { getCrossMediaConnections } from "@/lib/crossmedia/discovery";

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  return { title: artist?.name ?? "Artist" };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();

  const session = await requireSession();
  const userId = session.user.id;
  const [{ saved, userScore }, crossMedia] = await Promise.all([
    getUserContentState(userId, "artist", artist.id),
    getCrossMediaConnections("artist", artist.id, userId),
  ]);

  const albums = artist.albums.map((al) => albumToCard({ ...al, artist }));
  const songs = artist.songs.map((s) => songToCard({ ...s, artist }));

  return (
    <div className="flex flex-col gap-10 pb-16">
      <div className="flex flex-col items-center gap-4 px-4 pt-10 text-center sm:px-8">
        <div className="relative h-40 w-40 overflow-hidden rounded-full shadow-lg sm:h-48 sm:w-48">
          <Image src={artist.imageUrl} alt="" fill sizes="200px" className="object-cover" />
        </div>
        <h1 className="text-h3 font-bold">{artist.name}</h1>
        <GenreBadges genres={artist.genres} />
        {artist.bio && <p className="max-w-xl text-body-md text-muted-foreground">{artist.bio}</p>}
        <DetailActions kind="artist" contentId={artist.id} title={artist.name} initialSaved={saved} initialUserScore={userScore} />
      </div>

      <div className="flex flex-col gap-10 sm:px-8">
        <ContentRow title="Popular songs" items={songs} />
        <ContentRow title="Albums" items={albums} />
        <CrossMediaSection result={crossMedia} title="Watch this feeling" />
      </div>
    </div>
  );
}
