import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { GENRES, MOVIES, SHOWS, ARTISTS, ALBUMS } from "../src/lib/mock/seed-data";
import { slugify, upsertMovies, upsertShows, upsertArtists, upsertAlbums, type GenreCache } from "./seed-lib";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding genres...");
  const genreCache: GenreCache = new Map();
  for (const name of GENRES) {
    const slug = slugify(name);
    const genre = await prisma.genre.upsert({ where: { slug }, update: { name }, create: { name, slug } });
    genreCache.set(name, genre.id);
  }

  console.log("Seeding movies...");
  await upsertMovies(prisma, genreCache, MOVIES);

  console.log("Seeding TV shows + episodes...");
  await upsertShows(prisma, genreCache, SHOWS);

  console.log("Seeding artists...");
  const artistBySlug = await upsertArtists(prisma, ARTISTS);

  console.log("Seeding albums + songs...");
  await upsertAlbums(prisma, genreCache, artistBySlug, ALBUMS);

  const [movieCount, showCount, episodeCount, artistCount, albumCount, songCount] = await Promise.all([
    prisma.movie.count(),
    prisma.tVShow.count(),
    prisma.episode.count(),
    prisma.artist.count(),
    prisma.album.count(),
    prisma.song.count(),
  ]);

  console.log(
    `Done. movies=${movieCount} shows=${showCount} episodes=${episodeCount} artists=${artistCount} albums=${albumCount} songs=${songCount}`
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
