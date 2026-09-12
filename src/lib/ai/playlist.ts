import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { songToCard } from "@/lib/content/mappers";
import { parsePrompt } from "@/lib/ai/prompt-parser";
import type { ContentCard } from "@/types/content";
import type { GeneratedItem } from "@/lib/ai/watchlist";

export interface GeneratedPlaylist {
  title: string;
  description: string;
  items: GeneratedItem[];
}

function titleCase(words: string[]): string {
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(", ");
}

/**
 * Same rule-based approach as generateWatchlist, applied to songs: parse the
 * prompt against real mood/genre vocabulary, rank real catalog songs by
 * prompt match + the user's actual listening/rating-derived taste signal,
 * and give each pick a reason grounded in that match.
 */
export async function generatePlaylist(userId: string, prompt: string): Promise<GeneratedPlaylist> {
  const [intent, signal] = await Promise.all([parsePrompt(prompt), buildTasteSignal(userId)]);

  const moodFilter = intent.moods.length > 0 ? { moods: { hasSome: intent.moods } } : {};
  const genreFilter = intent.genres.length > 0 ? { genres: { some: { name: { in: intent.genres } } } } : {};

  const songs = await prisma.song.findMany({
    where: {
      ...moodFilter,
      ...genreFilter,
      ...(intent.excludedGenres.length > 0 ? { genres: { none: { name: { in: intent.excludedGenres } } } } : {}),
    },
    include: { genres: true, artist: true, album: true },
    take: 80,
    orderBy: { communityRating: "desc" },
  });

  const candidates: ContentCard[] = songs
    .map(songToCard)
    .filter((c) => !c.moods?.some((m) => intent.excludedMoods.includes(m)));

  const scored = candidates.map((card) => {
    const moodMatch = (card.moods ?? []).filter((m) => intent.moods.includes(m)).length;
    const genreMatch = (card.genres ?? []).filter((g) => intent.genres.includes(g)).length;
    const artistBoost = card.artistId ? Math.max(0, signal.artistWeights.get(card.artistId) ?? 0) : 0;
    const tasteScore =
      (card.genres ?? []).reduce((sum, g) => sum + Math.max(0, signal.genreWeights.get(g) ?? 0), 0) +
      (card.moods ?? []).reduce((sum, m) => sum + Math.max(0, signal.moodWeights.get(m) ?? 0), 0) * 0.6 +
      artistBoost * 2;
    const promptMatch = moodMatch * 3 + genreMatch * 2;
    return { card, promptMatch, tasteScore, artistBoost, score: promptMatch * 10 + tasteScore + (card.rating ?? 0) * 0.3 };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, intent.count);

  const items: GeneratedItem[] = top.map(({ card, promptMatch, tasteScore, artistBoost }) => {
    const matchedMood = (card.moods ?? []).find((m) => intent.moods.includes(m));
    const matchedGenre = (card.genres ?? []).find((g) => intent.genres.includes(g));
    let reason: string;
    if (promptMatch > 0) {
      const parts = [matchedGenre, matchedMood].filter(Boolean);
      reason = `${parts.join(", ")} — matches what you asked for.`;
    } else if (artistBoost > 0 && card.subtitle) {
      reason = `You like ${card.subtitle}.`;
    } else if (tasteScore > 0) {
      const topGenre = (card.genres ?? []).sort(
        (a, b) => (signal.genreWeights.get(b) ?? 0) - (signal.genreWeights.get(a) ?? 0)
      )[0];
      reason = topGenre ? `You often enjoy ${topGenre.toLowerCase()}.` : "Matches your usual taste.";
    } else {
      reason = "Highly rated by the Aurora community.";
    }
    return { card, reason };
  });

  const titleParts = [...intent.moods.slice(0, 2), ...intent.genres.slice(0, 1)];
  const title = titleParts.length > 0 ? `${titleCase(titleParts)} Playlist` : "Your AI Playlist";

  return { title, description: prompt.trim(), items };
}
