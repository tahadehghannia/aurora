import type { ContentCard } from "@/types/content";
import type { TasteSignal } from "@/lib/recommendations/signals";

/** Scores a candidate on genre/mood/artist overlap with the user's taste signal. Range is unbounded but typically 0-15. */
export function scoreContentBased(candidate: ContentCard, signal: TasteSignal): number {
  let score = 0;

  for (const genre of candidate.genres ?? []) {
    score += signal.genreWeights.get(genre) ?? 0;
  }
  for (const mood of candidate.moods ?? []) {
    score += (signal.moodWeights.get(mood) ?? 0) * 0.6;
  }
  if (candidate.artistId) {
    score += (signal.artistWeights.get(candidate.artistId) ?? 0) * 1.2;
  }
  if (candidate.creator) {
    score += (signal.directorWeights.get(candidate.creator) ?? 0) * 1.2;
  }

  return score;
}
