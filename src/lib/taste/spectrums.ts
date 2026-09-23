import "server-only";
import { prisma } from "@/lib/db/prisma";
import { movieToCard, showToCard, albumToCard, songToCard } from "@/lib/content/mappers";
import { CONTENT_KIND_FROM_TYPE, CONTENT_ROUTE, type ContentCard, type ContentKind } from "@/types/content";
import type { SpectrumExemplar, SpectrumKey, TasteSpectrum } from "@/lib/taste/identity-types";

/**
 * A spectrum needs this many measured items before it's shown. Below it the
 * position would be noise, and a confidently-drawn bar over three data points
 * is exactly the Barnum failure this system exists to avoid.
 */
export const MIN_SAMPLE = 6;
export type { SpectrumKey, TasteSpectrum, SpectrumExemplar };

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

/** How many pieces of artwork stand behind one axis in the UI. */
const EXEMPLARS_PER_SPECTRUM = 4;

function toExemplar(card: ContentCard, side: "left" | "right"): SpectrumExemplar {
  return {
    id: `${card.kind}:${card.id}`,
    title: card.title,
    imageUrl: card.imageUrl,
    href: `/${CONTENT_ROUTE[card.kind]}/${card.slug}`,
    side,
  };
}

/**
 * The items that actually produced an axis position.
 *
 * Every predicate here is the same one used to compute the position a few lines
 * below — the dark-mood set, the slow-genre set, the popularity comparison.
 * That matters: artwork shown beside a number has to be the evidence for that
 * number, not a second opinion about the user's taste.
 *
 * Only the side the user leans toward is returned. Showing "light" titles next
 * to someone who leans dark would illustrate the axis at the cost of implying
 * something about them that isn't true.
 */
function pickExemplars(
  key: SpectrumKey,
  position: number,
  items: EngagedItem[],
  catalogueAvgPopularity: number
): SpectrumExemplar[] {
  const leansRight = position > 55;
  const leansLeft = position < 45;
  // A genuinely balanced axis has no single side to illustrate.
  const side: "left" | "right" = leansRight ? "right" : "left";

  const withImage = items.filter((i) => i.card.imageUrl.length > 0);

  const matching = (() => {
    switch (key) {
      case "reach": {
        const ranked = [...withImage]
          .filter((i) => typeof i.card.popularity === "number")
          .sort((a, b) => (a.card.popularity ?? 0) - (b.card.popularity ?? 0));
        // Niche end = least popular first; mainstream end = most popular first.
        return leansRight ? ranked : [...ranked].reverse();
      }
      case "tone": {
        const wanted = leansRight ? DARK_MOODS : LIGHT_MOODS;
        return withImage.filter((i) => (i.card.moods ?? []).some((m) => wanted.has(m)));
      }
      case "pace": {
        if (leansRight) {
          return withImage.filter(
            (i) => SLOW_GENRES.has(i.card.genres?.[0] ?? "") || (i.runtimeMin !== null && i.runtimeMin >= 140)
          );
        }
        return withImage.filter((i) => FAST_GENRES.has(i.card.genres?.[0] ?? ""));
      }
      case "breadth": {
        if (leansRight) {
          // Exploration is about range, so show one title per distinct genre.
          const seen = new Set<string>();
          return withImage.filter((i) => {
            const genre = i.card.genres?.[0];
            if (!genre || seen.has(genre)) return false;
            seen.add(genre);
            return true;
          });
        }
        // Comfort is the opposite: the genre they keep returning to.
        const counts = new Map<string, number>();
        for (const item of withImage) {
          const genre = item.card.genres?.[0];
          if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
        }
        const favourite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        return favourite ? withImage.filter((i) => i.card.genres?.[0] === favourite) : [];
      }
    }
  })();

  // Balanced axes still deserve artwork; fall back to the whole set rather than
  // showing nothing at all.
  const pool = matching.length > 0 || leansLeft || leansRight ? matching : withImage;
  void catalogueAvgPopularity;

  return pool.slice(0, EXEMPLARS_PER_SPECTRUM).map((i) => toExemplar(i.card, side));
}

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
      exemplars: pickExemplars("reach", position, items, catalogueAvg),
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
    const breadthPosition = clamp(ratio * 160);
    spectrums.push({
      key: "breadth",
      leftLabel: "Comfort",
      rightLabel: "Exploration",
      position: breadthPosition,
      sampleSize: genreTagged,
      exemplars: pickExemplars("breadth", breadthPosition, items, 0),
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
    const tonePosition = clamp((darkHits / toneTotal) * 100);
    spectrums.push({
      key: "tone",
      leftLabel: "Light",
      rightLabel: "Dark",
      position: tonePosition,
      sampleSize: toneTotal,
      exemplars: pickExemplars("tone", tonePosition, items, 0),
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
    const pacePosition = clamp((slowScore / paceSample) * 100);
    spectrums.push({
      key: "pace",
      leftLabel: "Fast-paced",
      rightLabel: "Slow-burn",
      position: pacePosition,
      sampleSize: Math.round(paceSample),
      exemplars: pickExemplars("pace", pacePosition, items, 0),
      evidence: `${Math.round(slowScore)} of ${Math.round(paceSample)} titles lean toward slower, unfolding stories.`,
    });
  }

  return spectrums;
}
