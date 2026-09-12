import type { ContentCard } from "@/types/content";
import type { TasteSignal } from "@/lib/recommendations/signals";
import type { CrossMediaConnection } from "@/lib/crossmedia/types";

export interface CrossMediaSource {
  title: string;
  moods: string[];
  genres: string[];
}

/** How much a candidate's genre/mood/artist overlap is backed by the *viewing user's* own taste signal — this is what makes the same source item produce different connections for different users (mood-bridge is shared, taste weighting is personal). */
export function tasteAffinity(card: ContentCard, signal: TasteSignal): number {
  const genreScore = (card.genres ?? []).reduce((sum, g) => sum + Math.max(0, signal.genreWeights.get(g) ?? 0), 0);
  const moodScore = (card.moods ?? []).reduce((sum, m) => sum + Math.max(0, signal.moodWeights.get(m) ?? 0), 0) * 0.6;
  const artistScore = card.artistId ? Math.max(0, signal.artistWeights.get(card.artistId) ?? 0) : 0;
  return genreScore + moodScore + artistScore;
}

export function moodOverlapCount(candidateMoods: string[], sourceMoods: string[]): number {
  const sourceSet = new Set(sourceMoods);
  return candidateMoods.filter((m) => sourceSet.has(m)).length;
}

/**
 * Builds one grounded, human-readable cross-media connection. Never a bare
 * score — always a sentence citing either the user's own real taste weight
 * (TASTE_BASED) or the actual mood overlap with the source item
 * (MOOD_BASED). Requires the candidate to share at least one mood with the
 * source, or it isn't a connection worth showing.
 */
export function buildConnection(
  card: ContentCard,
  source: CrossMediaSource,
  signal: TasteSignal,
  connectionLabel: string
): CrossMediaConnection {
  const affinity = tasteAffinity(card, signal);
  const overlap = moodOverlapCount(card.moods ?? [], source.moods);

  let reason: string;
  if (affinity > 1.5) {
    const topGenre = (card.genres ?? []).find((g) => (signal.genreWeights.get(g) ?? 0) > 0);
    const topMood = (card.moods ?? []).find((m) => (signal.moodWeights.get(m) ?? 0) > 0);
    reason = topGenre
      ? `Because you often enjoy ${topGenre.toLowerCase()}${topMood ? ` and ${topMood.toLowerCase()} stories` : ""}.`
      : "Matches taste you've shown elsewhere on Aurora.";
  } else if (overlap > 0) {
    const sharedMood = card.moods!.find((m) => source.moods.includes(m))!;
    reason = `Shares the ${sharedMood.toLowerCase()} tone of ${source.title}.`;
  } else {
    reason = `A different medium, same atmosphere as ${source.title}.`;
  }

  return {
    card,
    relationshipType: affinity > 1.5 ? "TASTE_BASED" : "MOOD_BASED",
    connectionLabel,
    reason,
  };
}

/** Ranks and trims candidates for one connection category — highest taste-affinity + mood-overlap first. */
export function pickBest(
  candidates: ContentCard[],
  source: CrossMediaSource,
  signal: TasteSignal,
  count: number,
  label: string
): CrossMediaConnection[] {
  return candidates
    .map((card) => buildConnection(card, source, signal, label))
    .sort((a, b) => {
      const scoreA = tasteAffinity(a.card, signal) + moodOverlapCount(a.card.moods ?? [], source.moods);
      const scoreB = tasteAffinity(b.card, signal) + moodOverlapCount(b.card.moods ?? [], source.moods);
      return scoreB - scoreA;
    })
    .slice(0, count);
}
