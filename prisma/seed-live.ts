import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { GENRES } from "../src/lib/mock/seed-data";
import { slugify, upsertMovies, upsertShows, upsertArtists, upsertAlbums, type GenreCache } from "./seed-lib";
import { getMovieProvider, getTvProvider, getMusicProvider, mockMovieProvider } from "../src/lib/content/providers";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// A curated, genre-spanning list — real, well-known titles/artists so the
// live-seeded catalog reads like an actual streaming/music library rather
// than a random API dump.
const TV_TITLES = [
  "Breaking Bad",
  "The Office",
  "Stranger Things",
  "The Crown",
  "Planet Earth II",
  "Ted Lasso",
  "Fargo",
  "The Bear",
  "Sherlock",
  "Chernobyl",
];

const MOVIE_TITLES = [
  "Interstellar",
  "The Grand Budapest Hotel",
  "Parasite",
  "Mad Max: Fury Road",
  "Arrival",
  "Whiplash",
  "Get Out",
  "The Social Network",
  "Spirited Away",
  "No Country for Old Men",
];

const MUSIC_ARTISTS = [
  "Radiohead",
  "Daft Punk",
  "Fleetwood Mac",
  "Kendrick Lamar",
  "Billie Eilish",
  "Tame Impala",
  "Miles Davis",
  "Bon Iver",
  "The Weeknd",
  "Phoebe Bridgers",
];

async function main() {
  console.log("Ensuring base genres exist...");
  const genreCache: GenreCache = new Map();
  for (const name of GENRES) {
    const slug = slugify(name);
    const genre = await prisma.genre.upsert({ where: { slug }, update: { name }, create: { name, slug } });
    genreCache.set(name, genre.id);
  }

  const tvProvider = getTvProvider();
  console.log(`Fetching TV shows from ${tvProvider.name}...`);
  const shows = await tvProvider.fetchShows(TV_TITLES);
  console.log(`  got ${shows.length}/${TV_TITLES.length} shows`);
  await upsertShows(prisma, genreCache, shows);

  const movieProvider = getMovieProvider();
  console.log(`Fetching movies from ${movieProvider.name}...`);
  if (movieProvider === mockMovieProvider) {
    console.log("  TMDB_API_KEY not set — skipping real movies (fictional movie catalog stays as-is).");
    console.log("  Set TMDB_API_KEY in .env to seed real movies here instead.");
  } else {
    const named = await movieProvider.fetchMovies(MOVIE_TITLES);
    console.log(`  got ${named.length}/${MOVIE_TITLES.length} named movies`);
    await upsertMovies(prisma, genreCache, named);

    if (movieProvider.fetchPopular) {
      const bulkCount = Number(process.env.SEED_MOVIE_COUNT ?? 500);
      console.log(`  bulk-fetching up to ${bulkCount} popular/top-rated movies...`);
      const bulk = await movieProvider.fetchPopular(bulkCount);
      console.log(`  got ${bulk.length} bulk movies`);
      await upsertMovies(prisma, genreCache, bulk);
    }
  }

  const musicProvider = getMusicProvider();
  console.log(`Fetching music from ${musicProvider.name}...`);
  const named = await musicProvider.fetchArtists(MUSIC_ARTISTS);
  console.log(`  got ${named.artists.length}/${MUSIC_ARTISTS.length} named artists, ${named.albums.length} albums`);
  const namedArtistBySlug = await upsertArtists(prisma, named.artists);
  await upsertAlbums(prisma, genreCache, namedArtistBySlug, named.albums);

  if (musicProvider.fetchPopular) {
    const bulkCount = Number(process.env.SEED_ARTIST_COUNT ?? 50);
    console.log(`  bulk-fetching up to ${bulkCount} chart artists...`);
    const bulk = await musicProvider.fetchPopular(bulkCount);
    console.log(`  got ${bulk.artists.length} bulk artists, ${bulk.albums.length} albums`);
    const bulkArtistBySlug = await upsertArtists(prisma, bulk.artists);
    await upsertAlbums(prisma, genreCache, bulkArtistBySlug, bulk.albums);
  }

  const [movieCount, showCount, episodeCount, artistCount, albumCount, songCount] = await Promise.all([
    prisma.movie.count(),
    prisma.tVShow.count(),
    prisma.episode.count(),
    prisma.artist.count(),
    prisma.album.count(),
    prisma.song.count(),
  ]);

  console.log(
    `Done. Catalog now: movies=${movieCount} shows=${showCount} episodes=${episodeCount} artists=${artistCount} albums=${albumCount} songs=${songCount}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
