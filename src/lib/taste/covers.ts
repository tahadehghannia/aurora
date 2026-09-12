import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";

const MOSAIC_SIZE = 4;

/** First few items' real artwork per collection, for a composed cover mosaic instead of a blank card. */
export async function getCollectionCovers(collectionIds: string[]): Promise<Map<string, string[]>> {
  const covers = new Map<string, string[]>();
  await Promise.all(
    collectionIds.map(async (id) => {
      const items = await prisma.collectionItem.findMany({
        where: { collectionId: id },
        orderBy: { position: "asc" },
        take: MOSAIC_SIZE,
      });
      const cards = await Promise.all(items.map((i) => getCardByKindAndId(CONTENT_KIND_FROM_TYPE[i.contentType], i.contentId)));
      covers.set(id, cards.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => c.imageUrl));
    })
  );
  return covers;
}

/** Same idea for playlists — song artwork comes from the parent album's cover. */
export async function getPlaylistCovers(playlistIds: string[]): Promise<Map<string, string[]>> {
  const covers = new Map<string, string[]>();
  await Promise.all(
    playlistIds.map(async (id) => {
      const items = await prisma.playlistItem.findMany({
        where: { playlistId: id },
        orderBy: { position: "asc" },
        take: MOSAIC_SIZE,
        include: { song: { include: { album: true } } },
      });
      const urls = items.map((i) => i.song.album?.coverUrl).filter((u): u is string => !!u);
      covers.set(id, urls);
    })
  );
  return covers;
}
