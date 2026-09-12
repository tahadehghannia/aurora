import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal, type TasteSignal } from "@/lib/recommendations/signals";
import type { Confidence } from "@/lib/taste/dna";
import { generateMoodProfileCopy } from "@/lib/taste/narrative-ai";
import type { TasteNarrative } from "@/lib/taste/narrative-types";

export interface MoodEntry {
  mood: string;
  confidence: Confidence;
  /** Share of total positive mood signal, 0-100 — only set once there's enough
   *  data across enough distinct moods for a percentage to mean anything. */
  percentage?: number;
}

export interface MoodProfile {
  hasEnoughSignal: boolean;
  /** AI summary of the moods below — null when unavailable (§28). */
  narrative?: TasteNarrative | null;
  /** Strongest moods across the user's whole history. */
  mostEnjoyed: MoodEntry[];
  /** Moods that show up in the last 30 days but aren't already a top mood. */
  recentlyExplored: string[];
  /** Real but still-weak mood signal — not enough repetition to call it a preference yet. */
  emerging: string[];
  /** Moods the user has explicitly muted via "Less like this" / "Not for me". */
  mutedMoods: string[];
}

const RECENT_WINDOW_DAYS = 30;
/** A percentage is only shown once at least this many distinct moods have real signal — otherwise two moods "splitting 100%" would be misleading. */
const MIN_MOODS_FOR_PERCENTAGE = 3;

function confidenceOf(weight: number): Confidence {
  if (weight >= 4) return "strong";
  if (weight >= 1.5) return "emerging";
  return "exploring";
}

/**
 * The Mood Profile reuses the same mood weights that power recommendations
 * (buildTasteSignal), split into "most enjoyed" (all-time, strong/emerging
 * confidence), "recently explored" (last 30 days only), and "emerging" (real
 * signal that's still too thin to call a preference) — so the copy can
 * honestly say "you often enjoy" vs "you've been exploring" instead of
 * treating every mood the same way.
 */
export async function getMoodProfile(
  userId: string,
  signal?: TasteSignal,
  options: { force?: boolean } = {}
): Promise<MoodProfile> {
  const taste = signal ?? (await buildTasteSignal(userId));
  const preference = await prisma.userPreference.findUnique({ where: { userId } });
  const mutedMoods = preference?.mutedMoods ?? [];

  const positiveMoods = [...taste.moodWeights.entries()].filter(
    ([mood, weight]) => weight > 0 && !mutedMoods.includes(mood)
  );
  const totalWeight = positiveMoods.reduce((sum, [, w]) => sum + w, 0);
  const showPercentages = positiveMoods.length >= MIN_MOODS_FOR_PERCENTAGE;

  const sorted = [...positiveMoods].sort((a, b) => b[1] - a[1]);

  const mostEnjoyed: MoodEntry[] = sorted
    .filter(([, weight]) => confidenceOf(weight) !== "exploring")
    .slice(0, 5)
    .map(([mood, weight]) => ({
      mood,
      confidence: confidenceOf(weight),
      percentage: showPercentages ? Math.round((weight / totalWeight) * 100) : undefined,
    }));

  const mostEnjoyedSet = new Set(mostEnjoyed.map((m) => m.mood));

  const since = new Date();
  since.setDate(since.getDate() - RECENT_WINDOW_DAYS);

  const [recentRatings, recentSaved, recentWatch, recentListen] = await Promise.all([
    prisma.rating.findMany({
      where: { userId, createdAt: { gte: since } },
      include: { movie: true, show: true, album: true, song: true, artist: true },
    }),
    prisma.savedItem.findMany({
      where: { userId, createdAt: { gte: since } },
      include: { movie: true, show: true, album: true, song: true, artist: true },
    }),
    prisma.watchHistory.findMany({ where: { userId, watchedAt: { gte: since } }, include: { movie: true, show: true } }),
    prisma.listeningHistory.findMany({ where: { userId, playedAt: { gte: since } }, include: { album: true, song: true } }),
  ]);

  const recentMoodCounts = new Map<string, number>();
  const bump = (moods: string[]) => {
    for (const mood of moods) recentMoodCounts.set(mood, (recentMoodCounts.get(mood) ?? 0) + 1);
  };
  for (const row of [...recentRatings, ...recentSaved]) {
    const content = row.movie ?? row.show ?? row.album ?? row.song ?? row.artist;
    if (content) bump(content.moods);
  }
  for (const row of recentWatch) bump((row.movie ?? row.show)?.moods ?? []);
  for (const row of recentListen) bump((row.song ?? row.album)?.moods ?? []);

  const recentlyExplored = [...recentMoodCounts.entries()]
    .filter(([mood]) => !mostEnjoyedSet.has(mood) && !mutedMoods.includes(mood))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([mood]) => mood);
  const recentlyExploredSet = new Set(recentlyExplored);

  // Computed last so it never repeats a mood already shown as "most enjoyed"
  // or "recently explored" — each mood appears in exactly one bucket.
  const emerging = sorted
    .filter(
      ([mood, weight]) =>
        confidenceOf(weight) === "exploring" && !mostEnjoyedSet.has(mood) && !recentlyExploredSet.has(mood)
    )
    .slice(0, 4)
    .map(([mood]) => mood);

  const profile: MoodProfile = {
    hasEnoughSignal: taste.hasSignal,
    mostEnjoyed,
    recentlyExplored,
    emerging,
    mutedMoods,
  };

  // Moods here are properties of content, never a claim about how the user
  // feels — copy that drifts into the latter is rejected rather than shown.
  const copy = await generateMoodProfileCopy(userId, profile, options);
  if (copy) {
    profile.narrative = {
      summary: copy.data.summary,
      aiGenerated: true,
      generatedAt: copy.generatedAt.toISOString(),
    };
  }

  return profile;
}
