import "server-only";
import { prisma } from "@/lib/db/prisma";
import { movieToCard, showToCard, albumToCard, songToCard } from "@/lib/content/mappers";
import { CONTENT_KIND_FROM_TYPE, type ContentCard, type ContentKind } from "@/types/content";
import type { SpectrumKey, TasteSpectrum } from "@/lib/taste/identity-types";

/**
 * A spectrum needs this many measured items before it's shown. Below it the
 * position would be noise, and a confidently-drawn bar over three data points
 * is exactly the Barnum failure this system exists to avoid.
 */
export const MIN_SAMPLE = 6;
export type { SpectrumKey, TasteSpectrum };

/** Mood tags that read as tonally heavy vs. light, drawn from the real catalogue vocabulary. */
const DARK_MOODS = new Set(["Dark", "Tense", "Melancholic", "Intense"]);
const LIGHT_MOODS = new Set(["Uplifting", "Comforting", "Whimsical", "Euphoric", "Energetic"]);

/** Genres whose pleasure is typically in the unfolding rather than the momentum. */
const SLOW_GENRES = new Set(["Drama", "Mystery", "Documentary", "History", "Romance"]);
const FAST_GENRES = new Set(["Action", "Adventure", "Thriller", "Comedy", "Animation"]);

interface EngagedItem {
  card: ContentCard;
  /** Runtime in minutes where the medium has one. */
  runtimeMin: number | null;
}

/**
 * Everything the user has deliberately engaged with: rated, saved, or watched.
 *
 * Batched by kind rather than resolved per row. Resolving each item
 * individually meant one query per item plus a second for movie runtime —
 * roughly 240 sequential round-trips for an active user, on a page that also
 * runs the whole recommendation pipeline. This is four queries regardless of
 * library size.
 */
async function getEngagedItems(userId: string, limit = 120): Promise<EngagedItem[]> {
  const [ratings, saved, watched] = await Promise.all([
    prisma.rating.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.savedItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.watchHistory.findMany({ where: { userId }, orderBy: { watchedAt: "desc" }, take: limit }),
  ]);

  // De-duplicate first so an item rated *and* saved *and* watched is one item.
  const seen = new Set<string>();
  const byKind = new Map<ContentKind, string[]>();
  for (const row of [...ratings, ...saved, ...watched]) {
    const key = `${row.contentType}:${row.contentId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const kind = CONTENT_KIND_FROM_TYPE[row.contentType];
    byKind.set(kind, [...(byKind.get(kind) ?? []), row.contentId]);
  }

  const movieIds = byKind.get("movie") ?? [];
  const showIds = byKind.get("tv_show") ?? [];
  const albumIds = byKind.get("album") ?? [];
  const songIds = byKind.get("song") ?? [];

  const [movies, shows, albums, songs] = await Promise.all([
    movieIds.length ? prisma.movie.findMany({ where: { id: { in: movieIds } }, include: { genres: true } }) : [],
    showIds.length ? prisma.tVShow.findMany({ where: { id: { in: showIds } }, include: { genres: true } }) : [],
    albumIds.length
      ? prisma.album.findMany({ where: { id: { in: albumIds } }, include: { genres: true, artist: true } })
      : [],
    songIds.length
      ? prisma.song.findMany({ where: { id: { in: songIds } }, include: { genres: true, artist: true, album: true } })
      : [],
  ]);

  return [
    // Runtime comes free from the same row the card is built from.
    ...movies.map((m) => ({ card: movieToCard(m), runtimeMin: m.runtimeMin })),
    ...shows.map((s) => ({ card: showToCard(s), runtimeMin: null })),
    ...albums.map((a) => ({ card: albumToCard(a), runtimeMin: null })),
    ...songs.map((s) => ({ card: songToCard(s), runtimeMin: null })),
  ];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Where the user sits on a handful of taste axes, each measured from their own
 * library. Positions are deliberately *comparative* where possible — the
 * research is explicit that accuracy without discriminative power is what makes
 * a personality result feel like a horoscope, so "more niche than the average
 * Aurora title" beats "you like interesting things".
 */
export async function getTasteSpectrums(userId: string): Promise<TasteSpectrum[]> {
  const items = await getEngagedItems(userId);
  if (items.length === 0) return [];

  const spectrums: TasteSpectrum[] = [];

  // --- Mainstream ↔ Niche -------------------------------------------------
  // Measured against the catalogue's own average popularity, so the claim is
  // relative to what Aurora actually holds rather than an absolute guess.
  const withPopularity = items.filter((i) => typeof i.card.popularity === "number");
  if (withPopularity.length >= MIN_SAMPLE) {
    const catalogueAvg = (await prisma.movie.aggregate({ _avg: { popularity: true } }))._avg.popularity ?? 50;
    const userAvg = withPopularity.reduce((sum, i) => sum + (i.card.popularity ?? 0), 0) / withPopularity.length;
    // Above catalogue average = mainstream end; below = niche end.
    const position = clamp(50 - (userAvg - catalogueAvg) * 1.5);
    spectrums.push({
      key: "reach",
      leftLabel: "Mainstream",
      rightLabel: "Niche",
      position,
      sampleSize: withPopularity.length,
      evidence:
        position > 55
          ? `What you pick is less mainstream than the average Aurora title.`
          : position < 45
            ? `What you pick skews more popular than the average Aurora title.`
            : `You sit close to the middle of the catalogue's popularity range.`,
    });
  }

  // --- Comfort ↔ Exploration ---------------------------------------------
  // Genre breadth relative to volume: revisiting a few genres vs. ranging wide.
  const genreCounts = new Map<string, number>();
  let genreTagged = 0;
  for (const item of items) {
    const primary = item.card.genres?.[0];
    if (!primary) continue;
    genreTagged++;
    genreCounts.set(primary, (genreCounts.get(primary) ?? 0) + 1);
  }
  if (genreTagged >= MIN_SAMPLE) {
    const distinct = genreCounts.size;
    // Breadth ratio: 1 genre across everything = pure comfort; a new genre
    // almost every time = pure exploration.
    const ratio = distinct / genreTagged;
    spectrums.push({
      key: "breadth",
      leftLabel: "Comfort",
      rightLabel: "Exploration",
      position: clamp(ratio * 160),
      sampleSize: genreTagged,
      evidence: `${distinct} different genres across ${genreTagged} titles.`,
    });
  }

  // --- Light ↔ Dark -------------------------------------------------------
  let darkHits = 0;
  let lightHits = 0;
  for (const item of items) {
    for (const mood of item.card.moods ?? []) {
      if (DARK_MOODS.has(mood)) darkHits++;
      else if (LIGHT_MOODS.has(mood)) lightHits++;
    }
  }
  const toneTotal = darkHits + lightHits;
  if (toneTotal >= MIN_SAMPLE) {
    spectrums.push({
      key: "tone",
      leftLabel: "Light",
      rightLabel: "Dark",
      position: clamp((darkHits / toneTotal) * 100),
      sampleSize: toneTotal,
      evidence: `${darkHits} of ${toneTotal} mood tags in your library are darker ones.`,
    });
  }

  // --- Fast-paced ↔ Slow-burn --------------------------------------------
  // Runtime where it exists, genre lean everywhere else.
  let slowScore = 0;
  let paceSample = 0;
  for (const item of items) {
    const primary = item.card.genres?.[0];
    if (primary && SLOW_GENRES.has(primary)) {
      slowScore += 1;
      paceSample++;
    } else if (primary && FAST_GENRES.has(primary)) {
      paceSample++;
    }
    // A long film is itself evidence of patience with pacing.
    if (item.runtimeMin && item.runtimeMin >= 140) {
      slowScore += 0.5;
      paceSample += 0.5;
    }
  }
  if (paceSample >= MIN_SAMPLE) {
    spectrums.push({
      key: "pace",
      leftLabel: "Fast-paced",
      rightLabel: "Slow-burn",
      position: clamp((slowScore / paceSample) * 100),
      sampleSize: Math.round(paceSample),
      evidence: `${Math.round(slowScore)} of ${Math.round(paceSample)} titles lean toward slower, unfolding stories.`,
    });
  }

  return spectrums;
}
