import "server-only";
import { prisma } from "@/lib/db/prisma";
import {
  movieToCard,
  showToCard,
  episodeToCard,
  artistToCard,
  albumToCard,
  songToCard,
} from "@/lib/content/mappers";
import { CONTENT_KIND_FROM_TYPE, type ContentCard, type ContentKind } from "@/types/content";

const GENRE_INCLUDE = { genres: true } as const;

export async function getGenres() {
  return prisma.genre.findMany({ orderBy: { name: "asc" } });
}

export async function getMoods(): Promise<string[]> {
  const [movies, shows, albums, songs] = await Promise.all([
    prisma.movie.findMany({ select: { moods: true } }),
    prisma.tVShow.findMany({ select: { moods: true } }),
    prisma.album.findMany({ select: { moods: true } }),
    prisma.song.findMany({ select: { moods: true } }),
  ]);
  const set = new Set<string>();
  for (const group of [movies, shows, albums, songs]) {
    for (const item of group) for (const mood of item.moods) set.add(mood);
  }
  return [...set].sort();
}

export async function getTrending(limit = 12): Promise<ContentCard[]> {
  const [movies, shows, albums] = await Promise.all([
    prisma.movie.findMany({ take: limit, orderBy: { popularity: "desc" }, include: GENRE_INCLUDE }),
    prisma.tVShow.findMany({ take: limit, orderBy: { popularity: "desc" }, include: GENRE_INCLUDE }),
    prisma.album.findMany({ take: limit, orderBy: { popularity: "desc" }, include: { ...GENRE_INCLUDE, artist: true } }),
  ]);
  const merged = [
    ...movies.map(movieToCard),
    ...shows.map(showToCard),
    ...albums.map(albumToCard),
  ].sort((a, b) => (b.rating ?? 0) * (b.ratingCount ?? 1) - (a.rating ?? 0) * (a.ratingCount ?? 1));
  return merged.slice(0, limit);
}

export async function getPopularMovies(limit = 12) {
  const movies = await prisma.movie.findMany({
    take: limit,
    orderBy: { popularity: "desc" },
    include: GENRE_INCLUDE,
  });
  return movies.map(movieToCard);
}

export async function getPopularShows(limit = 12) {
  const shows = await prisma.tVShow.findMany({
    take: limit,
    orderBy: { popularity: "desc" },
    include: GENRE_INCLUDE,
  });
  return shows.map(showToCard);
}

export async function getPopularMusic(limit = 12) {
  const albums = await prisma.album.findMany({
    take: limit,
    orderBy: { popularity: "desc" },
    include: { ...GENRE_INCLUDE, artist: true },
  });
  return albums.map(albumToCard);
}

export async function getPopularArtists(limit = 12) {
  const artists = await prisma.artist.findMany({
    take: limit,
    orderBy: { popularity: "desc" },
  });
  return artists.map(artistToCard);
}

export async function getTopRated(limit = 12): Promise<ContentCard[]> {
  const [movies, shows] = await Promise.all([
    prisma.movie.findMany({ take: limit, orderBy: { communityRating: "desc" }, include: GENRE_INCLUDE }),
    prisma.tVShow.findMany({ take: limit, orderBy: { communityRating: "desc" }, include: GENRE_INCLUDE }),
  ]);
  return [...movies.map(movieToCard), ...shows.map(showToCard)]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit);
}

export async function getNewReleases(limit = 12): Promise<ContentCard[]> {
  const [movies, albums] = await Promise.all([
    prisma.movie.findMany({ take: limit, orderBy: { releaseYear: "desc" }, include: GENRE_INCLUDE }),
    prisma.album.findMany({ take: limit, orderBy: { releaseYear: "desc" }, include: { ...GENRE_INCLUDE, artist: true } }),
  ]);
  return [...movies.map(movieToCard), ...albums.map(albumToCard)]
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, limit);
}

/** Well-rated but not widely popular — the "you might have missed this" row. */
export async function getHiddenGems(limit = 12): Promise<ContentCard[]> {
  const where = { popularity: { lt: 65 }, communityRating: { gte: 4 } };
  const [movies, shows, albums] = await Promise.all([
    prisma.movie.findMany({ where, take: limit, orderBy: { communityRating: "desc" }, include: GENRE_INCLUDE }),
    prisma.tVShow.findMany({ where, take: limit, orderBy: { communityRating: "desc" }, include: GENRE_INCLUDE }),
    prisma.album.findMany({
      where,
      take: limit,
      orderBy: { communityRating: "desc" },
      include: { ...GENRE_INCLUDE, artist: true },
    }),
  ]);
  return [...movies.map(movieToCard), ...shows.map(showToCard), ...albums.map(albumToCard)]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit);
}

export async function getRecentlyAdded(limit = 12): Promise<ContentCard[]> {
  const [movies, shows, albums] = await Promise.all([
    prisma.movie.findMany({ take: limit, orderBy: { createdAt: "desc" }, include: GENRE_INCLUDE }),
    prisma.tVShow.findMany({ take: limit, orderBy: { createdAt: "desc" }, include: GENRE_INCLUDE }),
    prisma.album.findMany({ take: limit, orderBy: { createdAt: "desc" }, include: { ...GENRE_INCLUDE, artist: true } }),
  ]);
  return [...movies.map(movieToCard), ...shows.map(showToCard), ...albums.map(albumToCard)].slice(0, limit);
}

/** Most recently watched/listened items for this user — deduped to the latest event per title. */
export async function getRecentActivity(userId: string, limit = 12): Promise<ContentCard[]> {
  const [watched, listened] = await Promise.all([
    prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: "desc" },
      take: limit * 2,
      distinct: ["contentType", "contentId"],
    }),
    prisma.listeningHistory.findMany({
      where: { userId },
      orderBy: { playedAt: "desc" },
      take: limit * 2,
      distinct: ["contentType", "contentId"],
    }),
  ]);

  const events = [
    ...watched.map((w) => ({ kind: CONTENT_KIND_FROM_TYPE[w.contentType], id: w.contentId, at: w.watchedAt })),
    ...listened.map((l) => ({ kind: CONTENT_KIND_FROM_TYPE[l.contentType], id: l.contentId, at: l.playedAt })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);

  const cards = await Promise.all(events.map((e) => getCardByKindAndId(e.kind, e.id)));
  return cards.filter((c): c is ContentCard => c !== null);
}

export interface DiscoverFilters {
  kind?: "movie" | "tv_show" | "music";
  genre?: string;
  mood?: string;
  year?: number;
  minRating?: number;
  sort?: "popularity" | "rating" | "newest";
  limit?: number;
}

export async function discoverContent(filters: DiscoverFilters): Promise<ContentCard[]> {
  const { kind, genre, mood, year, minRating, sort = "popularity", limit = 24 } = filters;
  const orderBy =
    sort === "rating"
      ? { communityRating: "desc" as const }
      : sort === "newest"
        ? { releaseYear: "desc" as const }
        : { popularity: "desc" as const };

  const genreFilter = genre ? { genres: { some: { slug: genre } } } : {};
  const moodFilter = mood ? { moods: { has: mood } } : {};
  const ratingFilter = minRating ? { communityRating: { gte: minRating } } : {};

  const results: ContentCard[] = [];

  if (!kind || kind === "movie") {
    const movies = await prisma.movie.findMany({
      where: { ...genreFilter, ...moodFilter, ...ratingFilter, ...(year ? { releaseYear: year } : {}) },
      orderBy,
      take: limit,
      include: GENRE_INCLUDE,
    });
    results.push(...movies.map(movieToCard));
  }
  if (!kind || kind === "tv_show") {
    const shows = await prisma.tVShow.findMany({
      where: { ...genreFilter, ...moodFilter, ...ratingFilter, ...(year ? { firstAirYear: year } : {}) },
      orderBy,
      take: limit,
      include: GENRE_INCLUDE,
    });
    results.push(...shows.map(showToCard));
  }
  if (!kind || kind === "music") {
    const albums = await prisma.album.findMany({
      where: { ...genreFilter, ...moodFilter, ...ratingFilter, ...(year ? { releaseYear: year } : {}) },
      orderBy,
      take: limit,
      include: { ...GENRE_INCLUDE, artist: true },
    });
    results.push(...albums.map(albumToCard));
  }

  results.sort((a, b) => {
    if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    if (sort === "newest") return (b.year ?? 0) - (a.year ?? 0);
    return 0;
  });

  return results.slice(0, limit);
}

export interface SearchResults {
  movies: ContentCard[];
  shows: ContentCard[];
  episodes: ContentCard[];
  artists: ContentCard[];
  albums: ContentCard[];
  songs: ContentCard[];
  total: number;
}

export async function searchContent(query: string, limit = 8): Promise<SearchResults> {
  const q = query.trim();
  if (!q) {
    return { movies: [], shows: [], episodes: [], artists: [], albums: [], songs: [], total: 0 };
  }

  const contains = { contains: q, mode: "insensitive" as const };

  const [movies, shows, episodes, artists, albums, songs] = await Promise.all([
    prisma.movie.findMany({ where: { title: contains }, take: limit, include: GENRE_INCLUDE }),
    prisma.tVShow.findMany({ where: { title: contains }, take: limit, include: GENRE_INCLUDE }),
    prisma.episode.findMany({ where: { title: contains }, take: limit, include: { show: true } }),
    prisma.artist.findMany({ where: { name: contains }, take: limit }),
    prisma.album.findMany({ where: { title: contains }, take: limit, include: { ...GENRE_INCLUDE, artist: true } }),
    prisma.song.findMany({ where: { title: contains }, take: limit, include: { ...GENRE_INCLUDE, artist: true, album: true } }),
  ]);

  const mapped = {
    movies: movies.map(movieToCard),
    shows: shows.map(showToCard),
    episodes: episodes.map(episodeToCard),
    artists: artists.map(artistToCard),
    albums: albums.map(albumToCard),
    songs: songs.map(songToCard),
  };

  return {
    ...mapped,
    total: Object.values(mapped).reduce((sum, arr) => sum + arr.length, 0),
  };
}

export async function getMovieBySlug(slug: string) {
  return prisma.movie.findUnique({ where: { slug }, include: GENRE_INCLUDE });
}

export async function getShowBySlug(slug: string) {
  return prisma.tVShow.findUnique({
    where: { slug },
    include: { ...GENRE_INCLUDE, episodes: { orderBy: [{ season: "asc" }, { episodeNumber: "asc" }] } },
  });
}

export async function getEpisodeBySlug(slug: string) {
  return prisma.episode.findUnique({ where: { slug }, include: { show: true } });
}

export async function getArtistBySlug(slug: string) {
  return prisma.artist.findUnique({
    where: { slug },
    include: { albums: { orderBy: { releaseYear: "desc" } }, songs: { include: { album: true }, orderBy: { popularity: "desc" } } },
  });
}

export async function getAlbumBySlug(slug: string) {
  return prisma.album.findUnique({
    where: { slug },
    include: { artist: true, genres: true, songs: { orderBy: { id: "asc" } } },
  });
}

export async function getSongBySlug(slug: string) {
  return prisma.song.findUnique({
    where: { slug },
    include: { artist: true, album: true, genres: true },
  });
}

/** Resolves a polymorphic (kind, id) pair to its display card — used by library/ratings/recs. */
export async function getCardByKindAndId(kind: ContentKind, id: string): Promise<ContentCard | null> {
  switch (kind) {
    case "movie": {
      const m = await prisma.movie.findUnique({ where: { id }, include: GENRE_INCLUDE });
      return m ? movieToCard(m) : null;
    }
    case "tv_show": {
      const s = await prisma.tVShow.findUnique({ where: { id }, include: GENRE_INCLUDE });
      return s ? showToCard(s) : null;
    }
    case "episode": {
      const e = await prisma.episode.findUnique({ where: { id }, include: { show: true } });
      return e ? episodeToCard(e) : null;
    }
    case "artist": {
      const a = await prisma.artist.findUnique({ where: { id } });
      return a ? artistToCard(a) : null;
    }
    case "album": {
      const al = await prisma.album.findUnique({ where: { id }, include: { ...GENRE_INCLUDE, artist: true } });
      return al ? albumToCard(al) : null;
    }
    case "song": {
      const s = await prisma.song.findUnique({ where: { id }, include: { ...GENRE_INCLUDE, artist: true, album: true } });
      return s ? songToCard(s) : null;
    }
  }
}
