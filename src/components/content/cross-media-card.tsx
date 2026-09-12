import Link from "next/link";
import Image from "next/image";
import { CONTENT_ROUTE } from "@/types/content";
import type { CrossMediaConnection } from "@/lib/crossmedia/types";

const KIND_LABEL: Record<string, string> = {
  movie: "Movie",
  tv_show: "TV Show",
  artist: "Artist",
  album: "Album",
  song: "Song",
};

/** A compact cross-media connection card — artwork, title, kind, and the grounded reason it's here. Deliberately smaller than a primary content card; the connection is the point, not the artwork. */
export function CrossMediaCard({ connection }: { connection: CrossMediaConnection }) {
  const { card, connectionLabel, reason } = connection;

  return (
    <Link
      href={`/${CONTENT_ROUTE[card.kind]}/${card.slug}`}
      className="flex w-40 shrink-0 flex-col gap-2 sm:w-44"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
        <Image src={card.imageUrl} alt="" fill sizes="176px" className="object-cover transition-transform group-hover:scale-[1.02]" />
      </div>
      <div className="space-y-0.5">
        <p className="text-caption font-medium uppercase tracking-wide text-brand">{connectionLabel}</p>
        <p className="truncate text-body-sm font-medium text-foreground">{card.title}</p>
        <p className="text-caption text-muted-foreground">{KIND_LABEL[card.kind] ?? card.kind}</p>
        <p className="line-clamp-2 text-caption text-muted-foreground">{reason}</p>
      </div>
    </Link>
  );
}
