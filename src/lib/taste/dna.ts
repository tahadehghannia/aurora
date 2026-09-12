import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal, type TasteSignal } from "@/lib/recommendations/signals";

export type Confidence = "strong" | "emerging" | "exploring";

export interface WeightedLabel {
  name: string;
  weight: number;
  confidence: Confidence;
  /** Count of the user's own rated-4+/saved titles tied to this label — only set for creators/artists, where "N favorites" is a real, countable fact. */
  favoriteCount?: number;
}

export interface FavoriteArtist extends WeightedLabel {
  id: string;
  slug: string;
  imageUrl: string;
}

export interface EntertainmentDNA {
  hasEnoughSignal: boolean;
  /** A handful of top mood/style descriptors — the "Your Taste" chip row. */
  yourTaste: string[];
  favoriteGenres: WeightedLabel[];
  favoriteMoods: WeightedLabel[];
  favoriteCreators: WeightedLabel[];
  favoriteActors: WeightedLabel[];
  favoriteArtists: FavoriteArtist[];
}

/**
 * Weight-to-confidence thresholds, calibrated against how the signal engine
 * actually accumulates weight (buildTasteSignal): a single 5-star rating
 * contributes ~2.5 to a genre, a save ~1.5, implicit watch/listen ~0.75. So
 * "strong" needs the equivalent of several deliberate signals, "emerging"
 * needs at least two, and anything positive but below that is still just
 * "exploring" — not enough repetition yet to call it a real preference.
 */
function confidenceOf(weight: number): Confidence {
  if (weight >= 4) return "strong";
  if (weight >= 1.5) return "emerging";
  return "exploring";
}

function topEntries(map: Map<string, number>, limit: number): WeightedLabel[] {
  return [...map.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, weight]) => ({ name, weight, confidence: confidenceOf(weight) }));
}

/**
 * Entertainment DNA — a live summary of the same taste signal that drives
 * recommendations, not a separately-maintained profile. Every entry here is
 * a real genre/mood/artist/director/actor weight computed from the user's
 * own ratings, saves, and watch/listen history in buildTasteSignal.
 */
export async function getEntertainmentDNA(userId: string, signal?: TasteSignal): Promise<EntertainmentDNA> {
  const taste = signal ?? (await buildTasteSignal(userId));

  const favoriteGenres = topEntries(taste.genreWeights, 6);
  const favoriteMoods = topEntries(taste.moodWeights, 6);

  const creatorFavoriteCounts = new Map<string, number>();
  const artistFavoriteCounts = new Map<string, number>();
  for (const liked of taste.likedTitles) {
    if (liked.creator) creatorFavoriteCounts.set(liked.creator, (creatorFavoriteCounts.get(liked.creator) ?? 0) + 1);
    if (liked.artistId) artistFavoriteCounts.set(liked.artistId, (artistFavoriteCounts.get(liked.artistId) ?? 0) + 1);
  }

  const favoriteCreators = topEntries(taste.directorWeights, 5).map((c) => {
    const favoriteCount = creatorFavoriteCounts.get(c.name);
    return favoriteCount !== undefined ? { ...c, favoriteCount } : c;
  });
  const favoriteActors = topEntries(taste.actorWeights, 5);

  const topArtistIds = [...taste.artistWeights.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const artists =
    topArtistIds.length > 0
      ? await prisma.artist.findMany({
          where: { id: { in: topArtistIds.map(([id]) => id) } },
          select: { id: true, slug: true, name: true, imageUrl: true },
        })
      : [];
  const artistById = new Map(artists.map((a) => [a.id, a]));

  const favoriteArtists: FavoriteArtist[] = topArtistIds
    .map(([id, weight]) => {
      const artist = artistById.get(id);
      if (!artist) return null;
      const favoriteCount = artistFavoriteCounts.get(id);
      return {
        id,
        slug: artist.slug,
        name: artist.name,
        imageUrl: artist.imageUrl,
        weight,
        confidence: confidenceOf(weight),
        ...(favoriteCount !== undefined ? { favoriteCount } : {}),
      };
    })
    .filter((a): a is FavoriteArtist => a !== null);

  // "Your Taste" is deliberately just the strongest real mood signals, styled
  // as descriptive adjectives — not a fabricated personality label.
  const yourTaste = favoriteMoods.slice(0, 3).map((m) => m.name);

  return {
    hasEnoughSignal: taste.hasSignal,
    yourTaste,
    favoriteGenres,
    favoriteMoods,
    favoriteCreators,
    favoriteActors,
    favoriteArtists,
  };
}
