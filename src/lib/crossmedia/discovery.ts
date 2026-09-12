import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { movieToCard, showToCard, albumToCard, songToCard, artistToCard } from "@/lib/content/mappers";
import { pickBest, type CrossMediaSource } from "@/lib/crossmedia/explanations";
import type { ContentKind } from "@/types/content";
import type { CrossMediaConnection, CrossMediaResult } from "@/lib/crossmedia/types";

const GENRE_INCLUDE = { genres: true } as const;

async function moviesForMood(moods: string[], limit = 6) {
  return prisma.movie.findMany({ where: { moods: { hasSome: moods } }, include: GENRE_INCLUDE, orderBy: { communityRating: "desc" }, take: limit });
}
async function showsForMood(moods: string[], limit = 6) {
  return prisma.tVShow.findMany({ where: { moods: { hasSome: moods } }, include: GENRE_INCLUDE, orderBy: { communityRating: "desc" }, take: limit });
}
async function artistsForMood(moods: string[], limit = 6) {
  return prisma.artist.findMany({ where: { moods: { hasSome: moods } }, orderBy: { popularity: "desc" }, take: limit });
}
async function albumsForMood(moods: string[], limit = 6) {
  return prisma.album.findMany({ where: { moods: { hasSome: moods } }, include: { ...GENRE_INCLUDE, artist: true }, orderBy: { communityRating: "desc" }, take: limit });
}
async function songsForMood(moods: string[], limit = 6) {
  return prisma.song.findMany({ where: { moods: { hasSome: moods } }, include: { ...GENRE_INCLUDE, artist: true, album: true }, orderBy: { communityRating: "desc" }, take: limit });
}

/**
 * "Explore Beyond the Screen" / cross-media discovery: given a source item,
 * returns a small, curated set of connections into *other* media kinds,
 * bridged by real mood overlap (moodBridge) and personalized by the viewing
 * user's own taste signal (tasteBridge — buildTasteSignal, the same engine
 * that drives recommendations; see explanations.ts). Never returns
 * same-kind items (that's "More like this" / "Explore beyond this"), and
 * never claims a DIRECT_RELATIONSHIP the schema has no ground truth for —
 * every connection here is honestly labeled MOOD_BASED or TASTE_BASED.
 */
export async function getCrossMediaConnections(
  kind: ContentKind,
  id: string,
  userId: string
): Promise<CrossMediaResult | null> {
  const signal = await buildTasteSignal(userId);

  if (kind === "movie" || kind === "tv_show") {
    const source =
      kind === "movie"
        ? await prisma.movie.findUnique({ where: { id }, include: GENRE_INCLUDE })
        : await prisma.tVShow.findUnique({ where: { id }, include: GENRE_INCLUDE });
    if (!source || source.moods.length === 0) return null;

    const sourceInfo: CrossMediaSource = { title: source.title, moods: source.moods, genres: source.genres.map((g) => g.name) };

    const [otherMovies, otherShows, artists, albums, songs] = await Promise.all([
      kind === "tv_show" ? moviesForMood(source.moods) : Promise.resolve([]),
      kind === "movie" ? showsForMood(source.moods) : Promise.resolve([]),
      artistsForMood(source.moods),
      albumsForMood(source.moods),
      songsForMood(source.moods),
    ]);

    const connections: CrossMediaConnection[] = [
      ...pickBest(otherMovies.map(movieToCard), sourceInfo, signal, 1, "Watch next"),
      ...pickBest(otherShows.map(showToCard), sourceInfo, signal, 1, "Continue the feeling"),
      ...pickBest(artists.map(artistToCard), sourceInfo, signal, 2, "Explore the artist"),
      ...pickBest(albums.map(albumToCard), sourceInfo, signal, 1, "Listen next"),
      ...pickBest(songs.map(songToCard), sourceInfo, signal, 1, "Enter the mood"),
    ];

    if (connections.length === 0) return null;
    return { sourceTitle: source.title, connections };
  }

  if (kind === "artist" || kind === "album" || kind === "song") {
    let moods: string[] = [];
    let title = "";

    if (kind === "artist") {
      const source = await prisma.artist.findUnique({ where: { id } });
      if (!source) return null;
      moods = source.moods;
      title = source.name;
    } else if (kind === "album") {
      const source = await prisma.album.findUnique({ where: { id } });
      if (!source) return null;
      moods = source.moods;
      title = source.title;
    } else {
      const source = await prisma.song.findUnique({ where: { id } });
      if (!source) return null;
      moods = source.moods;
      title = source.title;
    }
    if (moods.length === 0) return null;

    const sourceInfo: CrossMediaSource = { title, moods, genres: [] };

    const [movies, shows] = await Promise.all([moviesForMood(moods), showsForMood(moods)]);

    const connections: CrossMediaConnection[] = [
      ...pickBest(movies.map(movieToCard), sourceInfo, signal, 2, "Watch next"),
      ...pickBest(shows.map(showToCard), sourceInfo, signal, 1, "Continue the feeling"),
    ];

    if (connections.length === 0) return null;
    return { sourceTitle: title, connections };
  }

  return null;
}

const KIND_FROM_CONTENT_TYPE: Record<string, ContentKind> = {
  MOVIE: "movie",
  TV_SHOW: "tv_show",
  ARTIST: "artist",
  ALBUM: "album",
  SONG: "song",
};

/**
 * Home's "Beyond Your Usual" — cross-media connections anchored to the
 * user's own single highest-rated title, so it's personalized without
 * requiring the user to be looking at a specific detail page.
 */
export async function getBeyondYourUsual(userId: string): Promise<CrossMediaResult | null> {
  const top = await prisma.rating.findFirst({
    where: { userId, score: { gte: 4 } },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });
  if (!top) return null;

  const kind = KIND_FROM_CONTENT_TYPE[top.contentType];
  if (!kind) return null;

  return getCrossMediaConnections(kind, top.contentId, userId);
}
