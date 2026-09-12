import type { SeedMovie } from "@/lib/mock/seed-data";
import { slugify, type MovieProvider } from "@/lib/content/providers/types";

/**
 * The Movie Database (https://developer.themoviedb.org) — real movie metadata
 * and artwork. Requires a free API read-access token. Set TMDB_API_KEY in
 * .env to activate this provider; Aurora falls back to its fictional catalog
 * for movies when it's absent (see providers/index.ts).
 */

const IMAGE_BASE = "https://image.tmdb.org/t/p";

interface TmdbMovie {
  id: number;
  title: string;
  tagline?: string;
  overview: string;
  release_date: string;
  runtime?: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  credits?: {
    cast: { name: string }[];
    crew: { name: string; job: string }[];
  };
}

interface TmdbSearchResult {
  results: { id: number }[];
}

interface TmdbDiscoverResult {
  results: { id: number }[];
  total_pages: number;
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${process.env.TMDB_API_KEY}`, Accept: "application/json" };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries on 429 (respecting Retry-After when TMDB sends it) and on transient 5xx — never on 4xx auth/not-found errors, which retrying can't fix. */
async function fetchJson<T>(url: string, attempt = 0): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: authHeaders(), next: { revalidate: 60 * 60 * 24 } });

    if (res.status === 429 && attempt < 4) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
      console.warn(`[TMDB] rate limited, retrying in ${delayMs}ms (attempt ${attempt + 1})`);
      await sleep(delayMs);
      return fetchJson<T>(url, attempt + 1);
    }
    if (res.status >= 500 && attempt < 3) {
      await sleep(500 * 2 ** attempt);
      return fetchJson<T>(url, attempt + 1);
    }
    if (!res.ok) {
      console.warn(`[TMDB] ${res.status} for ${url.replace(/\?.*/, "")}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[TMDB] network error for ${url.replace(/\?.*/, "")}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Runs async work over `items` with at most `concurrency` in flight at once — TMDB's v4 auth allows a generous rate, but bulk ingestion still shouldn't fire hundreds of requests at once. */
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/**
 * TMDB has no "mood" field, so Aurora's mood tags (used throughout
 * recommendations, Mood Profile, and cross-media discovery) are derived
 * from TMDB's real genre list via a fixed, documented genre→mood mapping —
 * not fabricated per-movie, and consistent with the same mood vocabulary
 * Aurora's fictional catalog already uses.
 */
const GENRE_MOOD_MAP: Record<string, string[]> = {
  Action: ["Energetic", "Intense"],
  Adventure: ["Uplifting", "Energetic"],
  Animation: ["Whimsical", "Comforting"],
  Comedy: ["Whimsical", "Uplifting"],
  Crime: ["Tense", "Dark"],
  Documentary: ["Thought-provoking", "Atmospheric"],
  Drama: ["Melancholic", "Thought-provoking"],
  Family: ["Comforting", "Uplifting"],
  Fantasy: ["Dreamy", "Whimsical"],
  History: ["Nostalgic", "Thought-provoking"],
  Horror: ["Tense", "Dark"],
  Music: ["Uplifting", "Energetic"],
  Mystery: ["Tense", "Thought-provoking"],
  Romance: ["Romantic", "Dreamy"],
  "Science Fiction": ["Atmospheric", "Thought-provoking"],
  "TV Movie": ["Comforting"],
  Thriller: ["Tense", "Intense"],
  War: ["Dark", "Thought-provoking"],
  Western: ["Atmospheric", "Nostalgic"],
};

function moodsForGenres(genreNames: string[]): string[] {
  const moods = new Set<string>();
  for (const genre of genreNames) {
    for (const mood of GENRE_MOOD_MAP[genre] ?? []) moods.add(mood);
    if (moods.size >= 3) break;
  }
  return moods.size > 0 ? [...moods] : ["Atmospheric"];
}

/**
 * TMDB's `popularity` is an unbounded, roughly log-distributed activity
 * score (typically single digits to a few hundred, occasionally higher for
 * a trending blockbuster) — clamping it straight to [0, 100] saturates
 * almost every real movie at 100. A log scale keeps the same ordering while
 * actually spreading real values across the 0-100 range Aurora's UI/ranking
 * expects.
 */
function normalizePopularity(raw: number): number {
  if (raw <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(raw + 1) / Math.log10(801)) * 100));
}

function mapMovie(movie: TmdbMovie): SeedMovie {
  const director = movie.credits?.crew.find((c) => c.job === "Director")?.name ?? "Unknown";
  const cast = (movie.credits?.cast ?? []).slice(0, 6).map((c) => c.name);
  const genres = movie.genres.map((g) => g.name);

  return {
    slug: `${slugify(movie.title)}-${movie.id}`,
    title: movie.title,
    tagline: movie.tagline ?? "",
    overview: movie.overview || "No synopsis available.",
    releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : new Date().getFullYear(),
    runtimeMin: movie.runtime ?? 100,
    director,
    cast,
    genres,
    moods: moodsForGenres(genres),
    popularity: normalizePopularity(movie.popularity),
    communityRating: Math.round(movie.vote_average * 10) / 10,
    ratingCount: movie.vote_count,
    posterUrl: movie.poster_path ? `${IMAGE_BASE}/w780${movie.poster_path}` : undefined,
    backdropUrl: movie.backdrop_path ? `${IMAGE_BASE}/original${movie.backdrop_path}` : undefined,
  };
}

const DISCOVER_PAGE_SIZE = 20;
/** Below this many votes, TMDB's "popular" list gets noisy (obscure titles with 1-2 inflated ratings) — Aurora only ingests titles with a real community behind them. */
const MIN_VOTE_COUNT = 100;

/**
 * Multiple sort strategies, paginated, deduped by TMDB id — pulling only
 * from "popular" would skew heavily toward recent blockbusters; adding
 * "top_rated" brings in well-regarded older/prestige titles too, which
 * matters for genre/mood diversity in the recommendation engine.
 */
const DISCOVER_STRATEGIES = ["popularity.desc", "vote_average.desc"] as const;

async function fetchDiscoverIds(sortBy: string, pages: number): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; page <= pages; page++) {
    const result = await fetchJson<TmdbDiscoverResult>(
      `https://api.themoviedb.org/3/discover/movie?sort_by=${sortBy}&vote_count.gte=${MIN_VOTE_COUNT}&page=${page}`
    );
    if (!result || result.results.length === 0) break;
    ids.push(...result.results.map((r) => r.id));
    if (page >= result.total_pages) break;
  }
  return ids;
}

export const tmdbProvider: MovieProvider = {
  name: "TMDB",
  isAvailable: () => !!process.env.TMDB_API_KEY,
  async fetchMovies(titles: string[]): Promise<SeedMovie[]> {
    if (!tmdbProvider.isAvailable()) return [];

    const movies: SeedMovie[] = [];
    for (const title of titles) {
      const search = await fetchJson<TmdbSearchResult>(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}`
      );
      const id = search?.results[0]?.id;
      if (!id) continue;

      const detail = await fetchJson<TmdbMovie>(
        `https://api.themoviedb.org/3/movie/${id}?append_to_response=credits`
      );
      if (detail) movies.push(mapMovie(detail));
    }
    return movies;
  },

  async fetchPopular(count: number): Promise<SeedMovie[]> {
    if (!tmdbProvider.isAvailable()) return [];

    const pagesPerStrategy = Math.ceil(count / DISCOVER_PAGE_SIZE / DISCOVER_STRATEGIES.length) + 1;
    const idLists = await Promise.all(DISCOVER_STRATEGIES.map((s) => fetchDiscoverIds(s, pagesPerStrategy)));
    const uniqueIds = [...new Set(idLists.flat())].slice(0, count);

    console.log(`[TMDB] fetching details for ${uniqueIds.length} movies...`);
    const details = await mapWithConcurrency(uniqueIds, 8, (id) =>
      fetchJson<TmdbMovie>(`https://api.themoviedb.org/3/movie/${id}?append_to_response=credits`)
    );

    return details.filter((d): d is TmdbMovie => d !== null).map(mapMovie);
  },
};
