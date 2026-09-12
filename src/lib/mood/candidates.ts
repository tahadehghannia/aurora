import "server-only";
import { prisma } from "@/lib/db/prisma";
import { movieToCard, showToCard } from "@/lib/content/mappers";
import { AUDIENCE_RULES } from "@/lib/mood/vocabulary";
import type { MoodIntent } from "@/lib/mood/intent";
import type { TasteSignal } from "@/lib/recommendations/signals";
import type { ContentCard } from "@/types/content";

/**
 * Candidate retrieval for a mood request (§9).
 *
 * Every item Aurora can possibly return comes from here, which means every item
 * is a real row with a real id. The model is never asked to name a title; it is
 * only ever asked to choose among these.
 *
 * The pool is deliberately wider than the final list (target ~120 vs 8) so that
 * ranking and diversification have room to work.
 */

export type CandidateSource =
  | "mood"
  | "genre"
  | "similar"
  | "taste"
  | "creator"
  | "popular"
  | "hidden_gem";

export interface MoodCandidate {
  card: ContentCard;
  /** Minutes, or null where the medium/row has no runtime — never guessed (§21). */
  runtimeMin: number | null;
  year: number;
  language: string;
  sources: CandidateSource[];
}

const GENRE_INCLUDE = { genres: true } as const;
const PER_SOURCE = 40;
export const POOL_TARGET = 200;

/** A recent release, for the "something new" intent. */
const NEW_SINCE_YEAR = new Date().getFullYear() - 4;
const CLASSIC_UNTIL_YEAR = 2005;

interface HardFilters {
  excludeGenres: string[];
  excludeMoods: string[];
  runtimeMaxMin: number | null;
  recency: MoodIntent["recency"];
}

/**
 * Constraints that are non-negotiable: an exclusion the user stated, an
 * audience that rules content out, or a runtime they don't have. These are
 * applied in the query rather than during ranking, so an excluded item can
 * never surface no matter how well it scores.
 */
function hardFilters(intent: MoodIntent): HardFilters {
  const excludeGenres = new Set(intent.excludeGenres);
  const excludeMoods = new Set(intent.excludeMoods);

  if (intent.audience) {
    const rules = AUDIENCE_RULES[intent.audience];
    for (const g of rules.avoidGenres) excludeGenres.add(g);
    for (const m of rules.avoidMoods) excludeMoods.add(m);
  }

  return {
    excludeGenres: [...excludeGenres],
    excludeMoods: [...excludeMoods],
    runtimeMaxMin: intent.runtimeMaxMin,
    recency: intent.recency,
  };
}

function movieWhere(filters: HardFilters, seen: Set<string>) {
  return {
    ...(seen.size > 0 ? { id: { notIn: [...seen] } } : {}),
    ...(filters.excludeGenres.length > 0 ? { genres: { none: { name: { in: filters.excludeGenres } } } } : {}),
    ...(filters.excludeMoods.length > 0 ? { NOT: { moods: { hasSome: filters.excludeMoods } } } : {}),
    // A null runtime is kept rather than assumed to fit; it is surfaced as
    // unknown in the UI and ranked below titles that provably fit.
    ...(filters.runtimeMaxMin
      ? { OR: [{ runtimeMin: { lte: filters.runtimeMaxMin } }, { runtimeMin: null }] }
      : {}),
    ...(filters.recency === "new" ? { releaseYear: { gte: NEW_SINCE_YEAR } } : {}),
    ...(filters.recency === "classic" ? { releaseYear: { lte: CLASSIC_UNTIL_YEAR } } : {}),
  };
}

function showWhere(filters: HardFilters, seen: Set<string>) {
  return {
    ...(seen.size > 0 ? { id: { notIn: [...seen] } } : {}),
    ...(filters.excludeGenres.length > 0 ? { genres: { none: { name: { in: filters.excludeGenres } } } } : {}),
    ...(filters.excludeMoods.length > 0 ? { NOT: { moods: { hasSome: filters.excludeMoods } } } : {}),
    ...(filters.recency === "new" ? { firstAirYear: { gte: NEW_SINCE_YEAR } } : {}),
    ...(filters.recency === "classic" ? { firstAirYear: { lte: CLASSIC_UNTIL_YEAR } } : {}),
  };
}

type MovieRow = Awaited<ReturnType<typeof prisma.movie.findMany<{ include: typeof GENRE_INCLUDE }>>>[number];
type ShowRow = Awaited<ReturnType<typeof prisma.tVShow.findMany<{ include: typeof GENRE_INCLUDE }>>>[number];

function fromMovie(row: MovieRow, source: CandidateSource): MoodCandidate {
  return {
    card: movieToCard(row),
    runtimeMin: row.runtimeMin,
    year: row.releaseYear,
    language: row.language,
    sources: [source],
  };
}

function fromShow(row: ShowRow, source: CandidateSource): MoodCandidate {
  return {
    card: showToCard(row),
    runtimeMin: null,
    year: row.firstAirYear,
    language: row.language,
    sources: [source],
  };
}

/**
 * Resolves "something like Interstellar" to that title's own genres and moods,
 * so similarity is computed from real metadata rather than the model's memory
 * of what the film is like.
 */
export async function resolveSimilarTo(
  title: string
): Promise<{ title: string; genres: string[]; moods: string[] } | null> {
  const movie = await prisma.movie.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    include: GENRE_INCLUDE,
  });
  if (movie) return { title: movie.title, genres: movie.genres.map((g) => g.name), moods: movie.moods };

  const loose = await prisma.movie.findFirst({
    where: { title: { contains: title, mode: "insensitive" } },
    include: GENRE_INCLUDE,
  });
  if (loose) return { title: loose.title, genres: loose.genres.map((g) => g.name), moods: loose.moods };

  const show = await prisma.tVShow.findFirst({
    where: { title: { contains: title, mode: "insensitive" } },
    include: GENRE_INCLUDE,
  });
  if (show) return { title: show.title, genres: show.genres.map((g) => g.name), moods: show.moods };

  return null;
}

export interface CandidatePool {
  candidates: MoodCandidate[];
  /** The referenced title, when one was found — drives an evidence-based reason. */
  similar: { title: string; genres: string[]; moods: string[] } | null;
}

/**
 * Builds the candidate pool from several independent sources so that a single
 * narrow filter can't starve the list. Sources overlap on purpose: an item
 * retrieved by more than one route is corroborated, and ranking rewards that.
 */
export async function getCandidatePool(
  intent: MoodIntent,
  signal: TasteSignal
): Promise<CandidatePool> {
  const filters = hardFilters(intent);

  const wantsMovies = intent.contentTypes.length === 0 || intent.contentTypes.includes("movie");
  // A series can't answer "I have 90 minutes", so a runtime cap rules shows out.
  const wantsShows =
    (intent.contentTypes.length === 0 || intent.contentTypes.includes("tv_show")) && !filters.runtimeMaxMin;

  const similar = intent.similarTo ? await resolveSimilarTo(intent.similarTo) : null;

  const topTasteGenres = [...signal.genreWeights.entries()]
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([g]) => g);

  const topCreators = [...signal.directorWeights.entries()]
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const moodTargets = [...new Set([...intent.moods, ...(similar?.moods ?? [])])];
  const genreTargets = [...new Set([...intent.genres, ...(similar?.genres ?? [])])];

  const movieBase = movieWhere(filters, signal.seen.movieIds);
  const showBase = showWhere(filters, signal.seen.showIds);

  const [
    moodMovies,
    genreMovies,
    tasteMovies,
    creatorMovies,
    popularMovies,
    gemMovies,
    moodShows,
    genreShows,
    popularShows,
  ] = await Promise.all([
    wantsMovies && moodTargets.length > 0
      ? prisma.movie.findMany({
          where: { ...movieBase, moods: { hasSome: moodTargets } },
          include: GENRE_INCLUDE,
          orderBy: { communityRating: "desc" },
          take: PER_SOURCE,
        })
      : [],
    wantsMovies && genreTargets.length > 0
      ? prisma.movie.findMany({
          where: { ...movieBase, genres: { some: { name: { in: genreTargets } } } },
          include: GENRE_INCLUDE,
          orderBy: { communityRating: "desc" },
          take: PER_SOURCE,
        })
      : [],
    wantsMovies && topTasteGenres.length > 0
      ? prisma.movie.findMany({
          where: { ...movieBase, genres: { some: { name: { in: topTasteGenres } } } },
          include: GENRE_INCLUDE,
          orderBy: { communityRating: "desc" },
          take: PER_SOURCE,
        })
      : [],
    wantsMovies && topCreators.length > 0
      ? prisma.movie.findMany({
          where: { ...movieBase, director: { in: topCreators } },
          include: GENRE_INCLUDE,
          take: 12,
        })
      : [],
    wantsMovies
      ? prisma.movie.findMany({
          where: movieBase,
          include: GENRE_INCLUDE,
          orderBy: { popularity: "desc" },
          take: PER_SOURCE,
        })
      : [],
    // Hidden gems: well reviewed but under-seen, so the list isn't only hits.
    wantsMovies
      ? prisma.movie.findMany({
          where: { ...movieBase, communityRating: { gte: 7 }, popularity: { lt: 40 } },
          include: GENRE_INCLUDE,
          orderBy: { communityRating: "desc" },
          take: 20,
        })
      : [],
    wantsShows && moodTargets.length > 0
      ? prisma.tVShow.findMany({
          where: { ...showBase, moods: { hasSome: moodTargets } },
          include: GENRE_INCLUDE,
          orderBy: { communityRating: "desc" },
          take: 20,
        })
      : [],
    wantsShows && genreTargets.length > 0
      ? prisma.tVShow.findMany({
          where: { ...showBase, genres: { some: { name: { in: genreTargets } } } },
          include: GENRE_INCLUDE,
          orderBy: { communityRating: "desc" },
          take: 20,
        })
      : [],
    wantsShows
      ? prisma.tVShow.findMany({
          where: showBase,
          include: GENRE_INCLUDE,
          orderBy: { popularity: "desc" },
          take: 20,
        })
      : [],
  ]);

  const byId = new Map<string, MoodCandidate>();
  const add = (candidate: MoodCandidate) => {
    const existing = byId.get(candidate.card.id);
    if (existing) {
      // Retrieved twice: record both routes rather than dropping the second.
      for (const s of candidate.sources) if (!existing.sources.includes(s)) existing.sources.push(s);
      return;
    }
    byId.set(candidate.card.id, candidate);
  };

  for (const row of moodMovies) add(fromMovie(row, "mood"));
  for (const row of genreMovies) add(fromMovie(row, similar ? "similar" : "genre"));
  for (const row of tasteMovies) add(fromMovie(row, "taste"));
  for (const row of creatorMovies) add(fromMovie(row, "creator"));
  for (const row of gemMovies) add(fromMovie(row, "hidden_gem"));
  for (const row of popularMovies) add(fromMovie(row, "popular"));
  for (const row of moodShows) add(fromShow(row, "mood"));
  for (const row of genreShows) add(fromShow(row, similar ? "similar" : "genre"));
  for (const row of popularShows) add(fromShow(row, "popular"));

  // "Hide this creator" overrides are absolute.
  const muted = new Set(signal.mutedCreators);
  const candidates = [...byId.values()].filter(
    (c) => !c.card.creator || !muted.has(`director:${c.card.creator}`)
  );

  return { candidates: candidates.slice(0, POOL_TARGET), similar };
}
