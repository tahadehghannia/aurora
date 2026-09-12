import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { movieToCard, showToCard, albumToCard } from "@/lib/content/mappers";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { rankCandidates } from "@/lib/recommendations/hybrid";
import { scoreContentBased } from "@/lib/recommendations/contentBased";
import { diversify } from "@/lib/recommendations/diversify";
import { buildCollaborativeModel, getUserRatingKeys } from "@/lib/recommendations/collaborative";
import { explainRecommendation, explainRecommendationChecklist } from "@/lib/recommendations/explanation";
import { buildRecommendationReasons } from "@/lib/recommendations/reasons";
import { getMaturityStage } from "@/lib/recommendations/maturity";
import { CONTENT_TYPE_MAP, type RecommendedCard, type RecommendationType, type ContentKind } from "@/types/content";

export type { TasteSignal } from "@/lib/recommendations/signals";

const getCandidatePool = cache(async function getCandidatePool(signal: Awaited<ReturnType<typeof buildTasteSignal>>) {
  const [movies, shows, albums] = await Promise.all([
    prisma.movie.findMany({
      where: { id: { notIn: [...signal.seen.movieIds] } },
      include: { genres: true },
      take: 200,
    }),
    prisma.tVShow.findMany({
      where: { id: { notIn: [...signal.seen.showIds] } },
      include: { genres: true },
      take: 200,
    }),
    prisma.album.findMany({
      where: { id: { notIn: [...signal.seen.albumIds] } },
      include: { genres: true, artist: true },
      take: 200,
    }),
  ]);

  const pool = [...movies.map(movieToCard), ...shows.map(showToCard), ...albums.map(albumToCard)];
  if (signal.mutedCreators.length === 0) return pool;

  const mutedDirectors = new Set(
    signal.mutedCreators.filter((c) => c.startsWith("director:")).map((c) => c.slice("director:".length))
  );
  const mutedArtists = new Set(
    signal.mutedCreators.filter((c) => c.startsWith("artist:")).map((c) => c.slice("artist:".length))
  );
  return pool.filter(
    (c) => !(c.creator && mutedDirectors.has(c.creator)) && !(c.artistId && mutedArtists.has(c.artistId))
  );
});

export interface GetRecommendationsOptions {
  limit?: number;
  kind?: ContentKind;
  recommendationType?: RecommendationType;
  /** Skip the best-effort write-back — for callers that reuse an already-persisted ranking. */
  persist?: boolean;
}

/**
 * The main entry point: personalized recommendations for a signed-in user.
 * Pipeline: taste signal → candidate pool → hybrid ranking (content +
 * collaborative + popularity, weighted by cold-start maturity stage) →
 * diversity re-ranking (strong fit / adjacent / exploration mix) →
 * explanation generation. Each stage is its own module — nothing here
 * belongs to a UI component.
 */
export async function getRecommendationsForUser(
  userId: string,
  options: GetRecommendationsOptions = {}
): Promise<RecommendedCard[]> {
  const { limit = 12, kind, recommendationType = "FOR_YOU", persist = true } = options;

  const [signal, model, userRatings, maturity] = await Promise.all([
    buildTasteSignal(userId),
    buildCollaborativeModel(),
    getUserRatingKeys(userId),
    getMaturityStage(userId),
  ]);
  const pool = await getCandidatePool(signal);
  const filtered = kind ? pool.filter((c) => c.kind === kind) : pool;

  const ranked = rankCandidates(filtered, signal, { model, userRatings }, maturity.stage);
  const diversified = diversify(ranked, { limit });
  const community = { model, userRatings };

  const results: RecommendedCard[] = diversified.map(({ card, score }) => ({
    ...card,
    score,
    reason: explainRecommendation(card, signal, community),
    reasons: explainRecommendationChecklist(card, signal, community),
    recommendationType,
  }));

  if (persist) {
    void persistRecommendations(userId, results).catch(() => {
      /* best-effort cache; recommendations still return to the caller if this fails */
    });
  }

  return results;
}

/** Structured, typed reasons for a set of recommended cards — the API-contract shape (see /api/recommendations). */
export async function getStructuredReasons(userId: string, cards: RecommendedCard[]) {
  const [signal, model, userRatings] = await Promise.all([
    buildTasteSignal(userId),
    buildCollaborativeModel(),
    getUserRatingKeys(userId),
  ]);
  const community = { model, userRatings };
  return cards.map((card) => ({ id: card.id, reasons: buildRecommendationReasons(card, signal, community) }));
}

/** "Because you liked X" — anchored to the single title the user rated highest, most recently. Null when there isn't one. */
export async function getBecauseYouLiked(
  userId: string,
  limit = 10
): Promise<{ sourceTitle: string; sourceKind: ContentKind; items: RecommendedCard[] } | null> {
  const top = await prisma.rating.findFirst({
    where: { userId, score: { gte: 4 } },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });
  if (!top) return null;

  const kind = Object.entries(CONTENT_TYPE_MAP).find(([, v]) => v === top.contentType)?.[0] as ContentKind | undefined;
  if (!kind || (kind !== "movie" && kind !== "tv_show" && kind !== "album")) return null;

  const items = await getSimilarTo(kind, top.contentId, limit);
  if (items.length === 0) return null;

  const source = await prisma.$transaction(async (tx) => {
    if (kind === "movie") return tx.movie.findUnique({ where: { id: top.contentId }, select: { title: true } });
    if (kind === "tv_show") return tx.tVShow.findUnique({ where: { id: top.contentId }, select: { title: true } });
    return tx.album.findUnique({ where: { id: top.contentId }, select: { title: true } });
  });
  if (!source) return null;

  return {
    sourceTitle: source.title,
    sourceKind: kind,
    items: items.map((i) => ({ ...i, recommendationType: "BECAUSE_YOU_LIKED" as const })),
  };
}

/** "Outside your usual taste" — candidates the ranking pipeline placed in the exploration tier (little/no content-based overlap, still quality/popular), for a dedicated Home row rather than folded into "For You". */
export async function getOutsideUsualTaste(userId: string, limit = 8): Promise<RecommendedCard[]> {
  const [signal, model, userRatings] = await Promise.all([
    buildTasteSignal(userId),
    buildCollaborativeModel(),
    getUserRatingKeys(userId),
  ]);
  if (!signal.hasSignal) return [];

  const pool = await getCandidatePool(signal);
  const ranked = rankCandidates(pool, signal, { model, userRatings });

  const exploration = ranked
    .filter((c) => c.contentScore <= 0 && (c.card.popularity ?? 0) >= 40)
    .sort((a, b) => (b.card.popularity ?? 0) - (a.card.popularity ?? 0))
    .slice(0, limit);

  return exploration.map(({ card }) => ({
    ...card,
    reason: "Outside your usual genres — worth a look.",
    recommendationType: "OUTSIDE_USUAL_TASTE" as const,
  }));
}

/**
 * Detail-page "Explore beyond this" — lateral discovery from the viewed
 * title: same mood, a *different* genre than the item itself, still
 * weighted by the viewing user's own taste signal. Distinct from "More like
 * this" (getSimilarTo, same-genre) — this is the depend-on-content-AND-user
 * exploration rail the spec calls for.
 */
export async function getExploreBeyond(
  kind: ContentKind,
  id: string,
  userId: string,
  limit = 8
): Promise<RecommendedCard[]> {
  if (kind !== "movie" && kind !== "tv_show") return [];

  const [source, signal] = await Promise.all([
    kind === "movie"
      ? prisma.movie.findUnique({ where: { id }, include: { genres: true } })
      : prisma.tVShow.findUnique({ where: { id }, include: { genres: true } }),
    buildTasteSignal(userId),
  ]);
  if (!source || source.moods.length === 0) return [];

  const excludeGenreIds = source.genres.map((g) => g.id);

  let cards: RecommendedCard[];
  if (kind === "movie") {
    const candidates = await prisma.movie.findMany({
      where: { id: { not: id }, moods: { hasSome: source.moods }, genres: { none: { id: { in: excludeGenreIds } } } },
      include: { genres: true },
      orderBy: { communityRating: "desc" },
      take: limit * 2,
    });
    cards = candidates.map(movieToCard);
  } else {
    const candidates = await prisma.tVShow.findMany({
      where: { id: { not: id }, moods: { hasSome: source.moods }, genres: { none: { id: { in: excludeGenreIds } } } },
      include: { genres: true },
      orderBy: { communityRating: "desc" },
      take: limit * 2,
    });
    cards = candidates.map(showToCard);
  }

  return cards
    .map((card) => ({ ...card, score: scoreContentBased(card, signal) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
    .map((card) => ({
      ...card,
      reason: `A different angle on the ${source.moods[0].toLowerCase()} mood of ${source.title}.`,
      recommendationType: "OUTSIDE_USUAL_TASTE" as const,
    }));
}

async function persistRecommendations(userId: string, results: RecommendedCard[]) {
  await prisma.$transaction(
    results.map((r) =>
      prisma.recommendation.upsert({
        where: {
          userId_contentType_contentId: {
            userId,
            contentType: CONTENT_TYPE_MAP[r.kind] as never,
            contentId: r.id,
          },
        },
        update: { score: r.score, reason: r.reason, source: "HYBRID" },
        create: {
          userId,
          contentType: CONTENT_TYPE_MAP[r.kind] as never,
          contentId: r.id,
          score: r.score ?? 0,
          reason: r.reason,
          source: "HYBRID",
        },
      })
    )
  );
}

/** Re-ranks genre-matched candidates so ones that also share a mood with the source sort first. */
function byMoodOverlap<T extends { moods: string[] }>(items: T[], sourceMoods: string[]): T[] {
  const moodSet = new Set(sourceMoods);
  return [...items].sort((a, b) => {
    const aOverlap = a.moods.filter((m) => moodSet.has(m)).length;
    const bOverlap = b.moods.filter((m) => moodSet.has(m)).length;
    return bOverlap - aOverlap;
  });
}

/** "Because you liked X, Y, Z" rail — same engine, framed around a single seed title. */
export async function getSimilarTo(kind: ContentKind, id: string, limit = 8): Promise<RecommendedCard[]> {
  if (kind === "movie") {
    const source = await prisma.movie.findUnique({ where: { id }, include: { genres: true } });
    if (!source) return [];
    const genreIds = source.genres.map((g) => g.id);
    const candidates = await prisma.movie.findMany({
      where: { id: { not: id }, genres: { some: { id: { in: genreIds } } } },
      include: { genres: true },
      orderBy: { popularity: "desc" },
      take: limit * 2,
    });
    return byMoodOverlap(candidates, source.moods)
      .slice(0, limit)
      .map((m) => ({ ...movieToCard(m), reason: `Similar to ${source.title}.` }));
  }

  if (kind === "tv_show") {
    const source = await prisma.tVShow.findUnique({ where: { id }, include: { genres: true } });
    if (!source) return [];
    const genreIds = source.genres.map((g) => g.id);
    const candidates = await prisma.tVShow.findMany({
      where: { id: { not: id }, genres: { some: { id: { in: genreIds } } } },
      include: { genres: true },
      orderBy: { popularity: "desc" },
      take: limit * 2,
    });
    return byMoodOverlap(candidates, source.moods)
      .slice(0, limit)
      .map((s) => ({ ...showToCard(s), reason: `Similar to ${source.title}.` }));
  }

  if (kind === "album") {
    const source = await prisma.album.findUnique({ where: { id }, include: { genres: true, artist: true } });
    if (!source) return [];
    const genreIds = source.genres.map((g) => g.id);

    const [sameArtist, genreMatched] = await Promise.all([
      prisma.album.findMany({
        where: { id: { not: id }, artistId: source.artistId },
        include: { genres: true, artist: true },
        orderBy: { releaseYear: "desc" },
        take: limit,
      }),
      prisma.album.findMany({
        where: { id: { not: id }, artistId: { not: source.artistId }, genres: { some: { id: { in: genreIds } } } },
        include: { genres: true, artist: true },
        orderBy: { popularity: "desc" },
        take: limit * 2,
      }),
    ]);

    // Same artist first ("more from this artist"), then genre/mood-matched picks from others.
    const rest = byMoodOverlap(genreMatched, source.moods).slice(0, Math.max(0, limit - sameArtist.length));
    return [...sameArtist, ...rest].slice(0, limit).map((al) => ({
      ...albumToCard(al),
      reason: al.artistId === source.artistId ? `More from ${source.artist.name}.` : `Similar to ${source.title}.`,
    }));
  }

  return [];
}
