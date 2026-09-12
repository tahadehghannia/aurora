import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Seeds a handful of demo community accounts with real ratings across the
 * existing catalog, so Taste Match / Friends Activity / Community Discovery
 * have real rows to compute similarity and activity feeds from — the same
 * spirit as seeding the content catalog itself. These are genuine User rows
 * with genuine Rating/SavedItem rows; nothing about the taste-match or
 * activity-feed *computation* is fabricated, it's real math over this data.
 * Safe to re-run: upserts by email/username.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface DemoUser {
  email: string;
  username: string;
  name: string;
  bio: string;
  moods: string[];
  genreHints: string[];
}

const DEMO_USERS: DemoUser[] = [
  {
    email: "sara.demo@aurora.app",
    username: "sara_atmospheric",
    name: "Sara Voss",
    bio: "Atmospheric sci-fi and slow-burn drama, mostly after dark.",
    moods: ["Atmospheric", "Melancholic", "Tense"],
    genreHints: ["Sci-Fi", "Drama", "Mystery", "Thriller"],
  },
  {
    email: "ali.demo@aurora.app",
    username: "ali_uplifting",
    name: "Ali Renner",
    bio: "Comfort watches and upbeat music for the commute.",
    moods: ["Uplifting", "Energetic", "Whimsical"],
    genreHints: ["Comedy", "Animation", "Pop", "Dance"],
  },
  {
    email: "reza.demo@aurora.app",
    username: "reza_nightowl",
    name: "Reza Faridi",
    bio: "Late-night listening and dark, character-driven TV.",
    moods: ["Dark", "Dreamy", "Nostalgic"],
    genreHints: ["Crime", "Drama", "Electronic", "Alternative"],
  },
];

async function ensureUser(demo: DemoUser) {
  const passwordHash = await bcrypt.hash("DemoAccount123", 12);
  const user = await prisma.user.upsert({
    where: { email: demo.email },
    update: { name: demo.name },
    create: { email: demo.email, name: demo.name, passwordHash },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: { bio: demo.bio, isPublic: true, onboardingCompleted: true },
    create: { userId: user.id, username: demo.username, bio: demo.bio, isPublic: true, onboardingCompleted: true },
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: { favoriteMoods: demo.moods },
    create: { userId: user.id, favoriteMoods: demo.moods },
  });

  return user;
}

async function rateForUser(userId: string, demo: DemoUser) {
  const [movies, shows, albums, songs] = await Promise.all([
    prisma.movie.findMany({ where: { genres: { some: { name: { in: demo.genreHints } } } }, take: 8 }),
    prisma.tVShow.findMany({ where: { genres: { some: { name: { in: demo.genreHints } } } }, take: 6 }),
    prisma.album.findMany({ where: { genres: { some: { name: { in: demo.genreHints } } } }, take: 6 }),
    prisma.song.findMany({ where: { genres: { some: { name: { in: demo.genreHints } } } }, take: 8 }),
  ]);

  const rate = async (
    contentType: "MOVIE" | "TV_SHOW" | "ALBUM" | "SONG",
    id: string,
    field: "movieId" | "showId" | "albumId" | "songId",
    score: number
  ) => {
    await prisma.rating.upsert({
      where: { userId_contentType_contentId: { userId, contentType, contentId: id } },
      update: { score },
      create: { userId, contentType, contentId: id, score, [field]: id },
    });
  };

  for (const [i, m] of movies.entries()) await rate("MOVIE", m.id, "movieId", i < 4 ? 4.5 : 4);
  for (const [i, s] of shows.entries()) await rate("TV_SHOW", s.id, "showId", i < 3 ? 5 : 4);
  for (const [i, al] of albums.entries()) await rate("ALBUM", al.id, "albumId", i < 3 ? 4.5 : 4);
  for (const [i, sg] of songs.entries()) await rate("SONG", sg.id, "songId", i < 4 ? 4.5 : 4);

  // A save or two per user as well, so "commonFavorites"/"discoverFromThem" have saved-item overlap too.
  for (const m of movies.slice(0, 2)) {
    await prisma.savedItem.upsert({
      where: { userId_contentType_contentId: { userId, contentType: "MOVIE", contentId: m.id } },
      update: {},
      create: { userId, contentType: "MOVIE", contentId: m.id, movieId: m.id },
    });
  }
}

async function main() {
  for (const demo of DEMO_USERS) {
    console.log(`Seeding community user ${demo.username}...`);
    const user = await ensureUser(demo);
    await rateForUser(user.id, demo);
  }
  console.log(`Done. ${DEMO_USERS.length} community accounts ready.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
