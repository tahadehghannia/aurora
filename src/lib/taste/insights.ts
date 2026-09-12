import "server-only";
import { prisma } from "@/lib/db/prisma";

const RECENT_WINDOW_DAYS = 30;
const MIN_ITEMS_PER_WINDOW = 3;
/** Minimum percentage-point swing before a shift is worth mentioning. */
const MIN_SHARE_DELTA = 0.15;

interface GenreShare {
  total: number;
  counts: Map<string, number>;
}

function shareOf(share: GenreShare, key: string): number {
  return share.total === 0 ? 0 : (share.counts.get(key) ?? 0) / share.total;
}

/**
 * Compares the genre mix of the user's saved content in the last 30 days
 * against everything saved before that, and — only when a genre's share
 * moved by at least MIN_SHARE_DELTA and both windows have enough data to be
 * meaningful — states the shift. Returns nothing rather than a weak or
 * unsupported claim.
 */
export async function getTasteInsights(userId: string): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - RECENT_WINDOW_DAYS);

  const [recentSaved, olderSaved] = await Promise.all([
    prisma.savedItem.findMany({
      where: { userId, createdAt: { gte: since } },
      include: { movie: { include: { genres: true } }, show: { include: { genres: true } }, album: { include: { genres: true } }, song: { include: { genres: true } } },
    }),
    prisma.savedItem.findMany({
      where: { userId, createdAt: { lt: since } },
      include: { movie: { include: { genres: true } }, show: { include: { genres: true } }, album: { include: { genres: true } }, song: { include: { genres: true } } },
    }),
  ]);

  const toShare = (rows: typeof recentSaved): GenreShare => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const row of rows) {
      const content = row.movie ?? row.show ?? row.album ?? row.song;
      if (!content) continue;
      total += 1;
      for (const genre of content.genres) counts.set(genre.name, (counts.get(genre.name) ?? 0) + 1);
    }
    return { total, counts };
  };

  const recent = toShare(recentSaved);
  const older = toShare(olderSaved);

  const insights: string[] = [];

  if (recent.total >= MIN_ITEMS_PER_WINDOW && older.total >= MIN_ITEMS_PER_WINDOW) {
    const allGenres = new Set([...recent.counts.keys(), ...older.counts.keys()]);
    let biggest: { genre: string; delta: number } | null = null;
    for (const genre of allGenres) {
      const delta = shareOf(recent, genre) - shareOf(older, genre);
      if (delta >= MIN_SHARE_DELTA && (!biggest || delta > biggest.delta)) {
        biggest = { genre, delta };
      }
    }
    if (biggest) {
      const pct = Math.round(shareOf(recent, biggest.genre) * 100);
      insights.push(`The share of your saved content that's ${biggest.genre.toLowerCase()} has grown to about ${pct}% recently.`);
    }
  }

  const [recentMoodRows, olderMoodRows] = [recentSaved, olderSaved].map((rows) => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const row of rows) {
      const content = row.movie ?? row.show ?? row.album ?? row.song;
      if (!content) continue;
      total += content.moods.length > 0 ? 1 : 0;
      for (const mood of content.moods) counts.set(mood, (counts.get(mood) ?? 0) + 1);
    }
    return { total, counts };
  });

  if (recentMoodRows.total >= MIN_ITEMS_PER_WINDOW && olderMoodRows.total >= MIN_ITEMS_PER_WINDOW) {
    const allMoods = new Set([...recentMoodRows.counts.keys(), ...olderMoodRows.counts.keys()]);
    let biggest: { mood: string; delta: number } | null = null;
    for (const mood of allMoods) {
      const delta = shareOf(recentMoodRows, mood) - shareOf(olderMoodRows, mood);
      if (delta >= MIN_SHARE_DELTA && (!biggest || delta > biggest.delta)) {
        biggest = { mood, delta };
      }
    }
    if (biggest) {
      insights.push(`You've been leaning toward ${biggest.mood.toLowerCase()} stories and sounds lately.`);
    }
  }

  return insights.slice(0, 3);
}
