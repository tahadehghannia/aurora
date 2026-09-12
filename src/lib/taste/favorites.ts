import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";
import type { ContentCard } from "@/types/content";

export interface FavoriteContent {
  movies: ContentCard[];
  shows: ContentCard[];
  albums: ContentCard[];
  artists: ContentCard[];
  songs: ContentCard[];
}

const PER_KIND_LIMIT = 10;
/** Only a rating this high counts as an actual "favorite," not just a positive one. */
const FAVORITE_THRESHOLD = 4;

/**
 * A user's real 4+/5 ratings, split by content kind for the typed layouts
 * the Profile favorites sections use (poster grids, artist cards, song
 * rows). Nothing here is inferred — every item is something the user
 * explicitly rated highly.
 */
export async function getFavoriteContent(userId: string): Promise<FavoriteContent> {
  const ratings = await prisma.rating.findMany({
    where: { userId, score: { gte: FAVORITE_THRESHOLD } },
    orderBy: { score: "desc" },
  });

  const byType = {
    MOVIE: ratings.filter((r) => r.contentType === "MOVIE").slice(0, PER_KIND_LIMIT),
    TV_SHOW: ratings.filter((r) => r.contentType === "TV_SHOW").slice(0, PER_KIND_LIMIT),
    ALBUM: ratings.filter((r) => r.contentType === "ALBUM").slice(0, PER_KIND_LIMIT),
    ARTIST: ratings.filter((r) => r.contentType === "ARTIST").slice(0, PER_KIND_LIMIT),
    SONG: ratings.filter((r) => r.contentType === "SONG").slice(0, PER_KIND_LIMIT),
  };

  const resolve = async (rows: typeof ratings) =>
    (await Promise.all(rows.map((r) => getCardByKindAndId(CONTENT_KIND_FROM_TYPE[r.contentType], r.contentId)))).filter(
      (c): c is ContentCard => c !== null
    );

  const [movies, shows, albums, artists, songs] = await Promise.all([
    resolve(byType.MOVIE),
    resolve(byType.TV_SHOW),
    resolve(byType.ALBUM),
    resolve(byType.ARTIST),
    resolve(byType.SONG),
  ]);

  return { movies, shows, albums, artists, songs };
}
