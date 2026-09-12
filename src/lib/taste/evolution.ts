import "server-only";
import { prisma } from "@/lib/db/prisma";
import { generateEvolutionCopy } from "@/lib/taste/narrative-ai";
import type { TasteNarrative } from "@/lib/taste/narrative-types";

export interface TasteEvolutionPeriod {
  label: string;
  topGenres: string[];
}

export interface TasteEvolution {
  available: boolean;
  periods: TasteEvolutionPeriod[];
  /** AI summary of the change across periods — null when unavailable (§28). */
  narrative?: TasteNarrative | null;
  /** A short label for the direction of travel, e.g. "toward slower stories". */
  shift?: string;
}

/** A period needs at least this many rated/saved items before its top genres are shown. */
const MIN_ITEMS_PER_PERIOD = 3;
/** Below this many distinct qualifying periods, there's no real "evolution" to show. */
const MIN_PERIODS = 2;

/**
 * Taste Evolution groups a user's own ratings and saves by the calendar year
 * they actually happened, and surfaces the top genres per year — nothing
 * here is simulated or interpolated. A user with activity concentrated in a
 * single period (the common case for a new account) correctly gets
 * `available: false` rather than a fabricated timeline.
 */
export async function getTasteEvolution(
  userId: string,
  options: { force?: boolean } = {}
): Promise<TasteEvolution> {
  const [ratings, saved] = await Promise.all([
    prisma.rating.findMany({
      where: { userId },
      include: { movie: { include: { genres: true } }, show: { include: { genres: true } }, album: { include: { genres: true } }, song: { include: { genres: true } } },
    }),
    prisma.savedItem.findMany({
      where: { userId },
      include: { movie: { include: { genres: true } }, show: { include: { genres: true } }, album: { include: { genres: true } }, song: { include: { genres: true } } },
    }),
  ]);

  const byYear = new Map<number, Map<string, number>>();

  for (const row of [...ratings, ...saved]) {
    const content = row.movie ?? row.show ?? row.album ?? row.song;
    if (!content) continue;
    const year = row.createdAt.getFullYear();
    const genreCounts = byYear.get(year) ?? new Map<string, number>();
    for (const genre of content.genres) {
      genreCounts.set(genre.name, (genreCounts.get(genre.name) ?? 0) + 1);
    }
    byYear.set(year, genreCounts);
  }

  const periods: TasteEvolutionPeriod[] = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, genreCounts]) => {
      const total = [...genreCounts.values()].reduce((a, b) => a + b, 0);
      const topGenres = [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre);
      return { year, total, topGenres };
    })
    .filter((p) => p.total >= MIN_ITEMS_PER_PERIOD && p.topGenres.length > 0)
    .map(({ year, topGenres }) => ({ label: String(year), topGenres }));

  const evolution: TasteEvolution = {
    available: periods.length >= MIN_PERIODS,
    periods,
  };

  // Only ever asked to describe change across periods Aurora actually measured.
  const copy = await generateEvolutionCopy(userId, evolution, options);
  if (copy) {
    evolution.narrative = {
      summary: copy.data.summary,
      aiGenerated: true,
      generatedAt: copy.generatedAt.toISOString(),
    };
    if (copy.data.shift) evolution.shift = copy.data.shift;
  }

  return evolution;
}
