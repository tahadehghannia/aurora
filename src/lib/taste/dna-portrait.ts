import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { getEntertainmentIdentity } from "@/lib/taste/identity";
import { isTakingShape } from "@/lib/taste/identity-types";
import { CONTENT_ROUTE, type ContentKind } from "@/types/content";
import {
  traitKey,
  type DnaPortrait,
  type PortraitItem,
  type PortraitLayer,
  type PortraitMotion,
  type PortraitTrait,
} from "@/lib/taste/dna-portrait-types";

/**
 * Builds the Entertainment DNA portrait: the handful of real artworks that
 * best represent someone's taste, ranked, layered and trait-mapped.
 *
 * Every item is here because of something the user actually did — a 4+ rating,
 * a save, a discovery. Nothing is chosen for looking good, and nothing is
 * padded in to fill the frame: an unfinished portrait is shown unfinished (§35).
 */

/** The composition reads as a portrait between these bounds (§5). */
const MAX_ITEMS = 12;
const MIN_ITEMS_FOR_PORTRAIT = 4;

/** A rating at or above this is a real favourite, not merely a positive. */
const FAVORITE_THRESHOLD = 4;

function layerFor(rank: number): PortraitLayer {
  if (rank < 3) return "foreground";
  if (rank < 7) return "midground";
  return "background";
}

/**
 * Assigns one motion per item.
 *
 * Deterministic from rank and kind so a portrait looks the same on every visit
 * — a composition that reshuffles itself stops being a portrait. Wide artwork
 * gets lateral drift, square cover art gets a light pass, and a deliberate
 * share of items stay completely still so the moving ones read as alive.
 */
function motionFor(rank: number, kind: ContentKind, hasBackdrop: boolean): PortraitMotion {
  // Every third item is still, which is what keeps the frame cinematic.
  if (rank % 3 === 2) return "still";
  if (kind === "album" || kind === "artist" || kind === "song") return "shimmer";
  return hasBackdrop && rank % 2 === 0 ? "drift" : "zoom";
}

interface Candidate {
  contentId: string;
  kind: ContentKind;
  slug: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  backdropUrl: string | null;
  genres: string[];
  moods: string[];
  /** Ranking weight: explicit rating first, then taste affinity. */
  weight: number;
  reason: string;
}

function hrefFor(kind: ContentKind, slug: string): string {
  return `/${CONTENT_ROUTE[kind]}/${slug}`;
}

/**
 * Resolves the user's strongest signals into candidates with real artwork.
 *
 * Batched per kind rather than per row — a portrait is built on every Profile
 * view, and one query per favourite would make it the slowest thing on the page.
 */
async function gatherCandidates(userId: string): Promise<Candidate[]> {
  const [ratings, saved] = await Promise.all([
    prisma.rating.findMany({
      where: { userId, score: { gte: FAVORITE_THRESHOLD } },
      orderBy: { score: "desc" },
      take: 40,
    }),
    prisma.savedItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const scoreById = new Map<string, number>();
  for (const rating of ratings) scoreById.set(`${rating.contentType}:${rating.contentId}`, rating.score);

  const idsFor = (type: string) =>
    [
      ...new Set([
        ...ratings.filter((r) => r.contentType === type).map((r) => r.contentId),
        ...saved.filter((s) => s.contentType === type).map((s) => s.contentId),
      ]),
    ];

  const movieIds = idsFor("MOVIE");
  const showIds = idsFor("TV_SHOW");
  const albumIds = idsFor("ALBUM");
  const artistIds = idsFor("ARTIST");

  const [movies, shows, albums, artists] = await Promise.all([
    movieIds.length
      ? prisma.movie.findMany({ where: { id: { in: movieIds } }, include: { genres: true } })
      : [],
    showIds.length ? prisma.tVShow.findMany({ where: { id: { in: showIds } }, include: { genres: true } }) : [],
    albumIds.length
      ? prisma.album.findMany({ where: { id: { in: albumIds } }, include: { genres: true, artist: true } })
      : [],
    artistIds.length ? prisma.artist.findMany({ where: { id: { in: artistIds } } }) : [],
  ]);

  const reasonFor = (key: string, title: string): string => {
    const score = scoreById.get(key);
    if (score) return `You rated ${title} ${score}/5.`;
    return `You saved ${title}.`;
  };

  // A rating outranks a save, and a 5 outranks a 4 — the weight is the evidence.
  const weightFor = (key: string): number => (scoreById.get(key) ?? 0) * 10 + (scoreById.has(key) ? 5 : 0);

  const candidates: Candidate[] = [
    ...movies.map((m) => ({
      contentId: m.id,
      kind: "movie" as const,
      slug: m.slug,
      title: m.title,
      subtitle: m.director,
      imageUrl: m.posterUrl,
      backdropUrl: m.backdropUrl,
      genres: m.genres.map((g) => g.name),
      moods: m.moods,
      weight: weightFor(`MOVIE:${m.id}`) + m.communityRating,
      reason: reasonFor(`MOVIE:${m.id}`, m.title),
    })),
    ...shows.map((s) => ({
      contentId: s.id,
      kind: "tv_show" as const,
      slug: s.slug,
      title: s.title,
      subtitle: s.creator,
      imageUrl: s.posterUrl,
      backdropUrl: s.backdropUrl,
      genres: s.genres.map((g) => g.name),
      moods: s.moods,
      weight: weightFor(`TV_SHOW:${s.id}`) + s.communityRating,
      reason: reasonFor(`TV_SHOW:${s.id}`, s.title),
    })),
    ...albums.map((a) => ({
      contentId: a.id,
      kind: "album" as const,
      slug: a.slug,
      title: a.title,
      subtitle: a.artist.name,
      imageUrl: a.coverUrl,
      backdropUrl: null,
      genres: a.genres.map((g) => g.name),
      moods: a.moods,
      weight: weightFor(`ALBUM:${a.id}`),
      reason: reasonFor(`ALBUM:${a.id}`, a.title),
    })),
    ...artists.map((a) => ({
      contentId: a.id,
      kind: "artist" as const,
      slug: a.slug,
      title: a.name,
      subtitle: null,
      imageUrl: a.imageUrl,
      backdropUrl: null,
      genres: a.genres,
      moods: a.moods,
      weight: weightFor(`ARTIST:${a.id}`),
      reason: reasonFor(`ARTIST:${a.id}`, a.name),
    })),
  ];

  // Real provider artwork beats a seeded placeholder when both are equally
  // well-evidenced (§16). A penalty rather than a filter: if a placeholder
  // title is genuinely someone's favourite, it still belongs in their portrait
  // — the user's taste outranks the picture's provenance (§17).
  return candidates
    .filter((c) => c.imageUrl.length > 0)
    .map((c) => (isPlaceholder(c.imageUrl) ? { ...c, weight: c.weight - 3 } : c));
}

/** Seeded fictional catalogue entries use picsum; real ingests never do. */
function isPlaceholder(url: string): boolean {
  return url.includes("picsum.photos");
}

export async function getDnaPortrait(userId: string): Promise<DnaPortrait> {
  const [identity, signal, candidates] = await Promise.all([
    getEntertainmentIdentity(userId),
    buildTasteSignal(userId),
    gatherCandidates(userId),
  ]);

  // The traits the portrait can be filtered by come from the user's own
  // strongest mood signals, so every filter chip has real artwork behind it.
  const topMoods = [...signal.moodWeights.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([mood]) => mood);

  const ranked = candidates.sort((a, b) => b.weight - a.weight).slice(0, MAX_ITEMS);

  const items: PortraitItem[] = ranked.map((candidate, rank) => {
    // An item's traits are the overlap between its own tags and the user's
    // strongest moods — the link that makes the filter meaningful (§18).
    const traits = candidate.moods.filter((mood) => topMoods.includes(mood));
    return {
      id: `${candidate.kind}:${candidate.contentId}`,
      contentId: candidate.contentId,
      kind: candidate.kind,
      slug: candidate.slug,
      href: hrefFor(candidate.kind, candidate.slug),
      title: candidate.title,
      subtitle: candidate.subtitle,
      imageUrl: candidate.imageUrl,
      backdropUrl: candidate.backdropUrl,
      traits,
      rank,
      layer: layerFor(rank),
      motion: motionFor(rank, candidate.kind, !!candidate.backdropUrl),
      reason: candidate.reason,
    };
  });

  // Only offer a trait filter where there is artwork to filter to.
  const traits: PortraitTrait[] = topMoods
    .map((mood) => ({
      key: traitKey(mood),
      label: mood,
      count: items.filter((item) => item.traits.includes(mood)).length,
    }))
    .filter((trait) => trait.count > 0)
    .sort((a, b) => b.count - a.count);

  const hasEnoughSignal = items.length >= MIN_ITEMS_FOR_PORTRAIT;
  const named = !isTakingShape(identity);

  return {
    identityName: named ? identity.archetype.name : null,
    identityDescription: named ? identity.narrative.description : null,
    identityTraits: named ? identity.traits.slice(0, 4) : [],
    items,
    traits,
    hasEnoughSignal,
    signalsSoFar: isTakingShape(identity) ? identity.signalsSoFar : items.length,
    // Show the shape of what's missing rather than filling it with strangers.
    openSlots: hasEnoughSignal ? 0 : Math.max(0, MIN_ITEMS_FOR_PORTRAIT + 2 - items.length),
  };
}
