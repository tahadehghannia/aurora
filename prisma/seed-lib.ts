import type { PrismaClient } from "../src/generated/prisma/client";
import type { SeedMovie, SeedShow, SeedArtist, SeedAlbum } from "../src/lib/mock/seed-data";
import { posterUrl, backdropUrl, stillUrl, avatarUrl, coverUrl } from "../src/lib/mock/seed-data";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type GenreCache = Map<string, string>;

/** Looks up a genre by name, creating it on demand — real providers surface genre names our static list doesn't have. */
export async function ensureGenre(prisma: PrismaClient, cache: GenreCache, name: string): Promise<string> {
  const existing = cache.get(name);
  if (existing) return existing;

  const slug = slugify(name);
  const genre = await prisma.genre.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });
  cache.set(name, genre.id);
  return genre.id;
}

async function genreIds(prisma: PrismaClient, cache: GenreCache, names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) ids.push(await ensureGenre(prisma, cache, name));
  return ids;
}

export async function upsertMovies(prisma: PrismaClient, cache: GenreCache, movies: SeedMovie[]) {
  for (const m of movies) {
    const ids = await genreIds(prisma, cache, m.genres);
    await prisma.movie.upsert({
      where: { slug: m.slug },
      update: {
        tagline: m.tagline,
        overview: m.overview,
        posterUrl: m.posterUrl ?? posterUrl(m.slug),
        backdropUrl: m.backdropUrl ?? backdropUrl(m.slug),
        director: m.director,
        cast: m.cast,
        moods: m.moods,
        communityRating: m.communityRating,
        ratingCount: m.ratingCount,
        popularity: m.popularity,
        genres: { set: ids.map((id) => ({ id })) },
      },
      create: {
        slug: m.slug,
        title: m.title,
        tagline: m.tagline,
        overview: m.overview,
        posterUrl: m.posterUrl ?? posterUrl(m.slug),
        backdropUrl: m.backdropUrl ?? backdropUrl(m.slug),
        releaseYear: m.releaseYear,
        runtimeMin: m.runtimeMin,
        director: m.director,
        cast: m.cast,
        moods: m.moods,
        popularity: m.popularity,
        communityRating: m.communityRating,
        ratingCount: m.ratingCount,
        genres: { connect: ids.map((id) => ({ id })) },
      },
    });
  }
}

export async function upsertShows(prisma: PrismaClient, cache: GenreCache, shows: SeedShow[]) {
  for (const s of shows) {
    const ids = await genreIds(prisma, cache, s.genres);
    const show = await prisma.tVShow.upsert({
      where: { slug: s.slug },
      update: {
        posterUrl: s.posterUrl ?? posterUrl(s.slug),
        backdropUrl: s.backdropUrl ?? backdropUrl(s.slug),
        communityRating: s.communityRating,
        ratingCount: s.ratingCount,
        popularity: s.popularity,
        genres: { set: ids.map((id) => ({ id })) },
      },
      create: {
        slug: s.slug,
        title: s.title,
        tagline: s.tagline,
        overview: s.overview,
        posterUrl: s.posterUrl ?? posterUrl(s.slug),
        backdropUrl: s.backdropUrl ?? backdropUrl(s.slug),
        firstAirYear: s.firstAirYear,
        seasonCount: s.seasonCount,
        creator: s.creator,
        cast: s.cast,
        moods: s.moods,
        popularity: s.popularity,
        communityRating: s.communityRating,
        ratingCount: s.ratingCount,
        genres: { connect: ids.map((id) => ({ id })) },
      },
    });

    for (const e of s.episodes) {
      const episodeSlug = `${s.slug}-s${e.season}e${e.episodeNumber}`;
      await prisma.episode.upsert({
        where: { slug: episodeSlug },
        update: { stillUrl: e.stillUrl ?? stillUrl(episodeSlug), communityRating: e.communityRating, ratingCount: e.ratingCount },
        create: {
          slug: episodeSlug,
          showId: show.id,
          title: e.title,
          overview: e.overview,
          stillUrl: e.stillUrl ?? stillUrl(episodeSlug),
          season: e.season,
          episodeNumber: e.episodeNumber,
          runtimeMin: e.runtimeMin,
          communityRating: e.communityRating,
          ratingCount: e.ratingCount,
        },
      });
    }
  }
}

export async function upsertArtists(prisma: PrismaClient, artists: SeedArtist[]): Promise<Map<string, string>> {
  const artistBySlug = new Map<string, string>();
  for (const a of artists) {
    const artist = await prisma.artist.upsert({
      where: { slug: a.slug },
      update: {
        bio: a.bio,
        imageUrl: a.imageUrl ?? avatarUrl(a.slug),
        genres: a.genres,
        moods: a.moods,
        popularity: a.popularity,
      },
      create: {
        slug: a.slug,
        name: a.name,
        bio: a.bio,
        imageUrl: a.imageUrl ?? avatarUrl(a.slug),
        genres: a.genres,
        moods: a.moods,
        popularity: a.popularity,
      },
    });
    artistBySlug.set(a.slug, artist.id);
  }
  return artistBySlug;
}

export async function upsertAlbums(
  prisma: PrismaClient,
  cache: GenreCache,
  artistBySlug: Map<string, string>,
  albums: SeedAlbum[]
) {
  for (const al of albums) {
    const artistId = artistBySlug.get(al.artistSlug);
    if (!artistId) continue;

    const ids = await genreIds(prisma, cache, al.genres);

    const album = await prisma.album.upsert({
      where: { slug: al.slug },
      update: {
        title: al.title,
        coverUrl: al.coverUrl ?? coverUrl(al.slug),
        moods: al.moods,
        communityRating: al.communityRating,
        ratingCount: al.ratingCount,
        popularity: al.popularity,
        genres: { set: ids.map((id) => ({ id })) },
      },
      create: {
        slug: al.slug,
        title: al.title,
        artistId,
        coverUrl: al.coverUrl ?? coverUrl(al.slug),
        releaseYear: al.releaseYear,
        moods: al.moods,
        popularity: al.popularity,
        communityRating: al.communityRating,
        ratingCount: al.ratingCount,
        genres: { connect: ids.map((id) => ({ id })) },
      },
    });

    for (const song of al.songs) {
      const songSlug = `${al.slug}-${slugify(song.title)}`;
      await prisma.song.upsert({
        where: { slug: songSlug },
        update: {
          title: song.title,
          moods: song.moods,
          communityRating: song.communityRating,
          ratingCount: song.ratingCount,
          popularity: song.popularity,
        },
        create: {
          slug: songSlug,
          title: song.title,
          artistId,
          albumId: album.id,
          durationSec: song.durationSec,
          moods: song.moods,
          popularity: song.popularity,
          communityRating: song.communityRating,
          ratingCount: song.ratingCount,
          genres: { connect: ids.map((id) => ({ id })) },
        },
      });
    }
  }
}
