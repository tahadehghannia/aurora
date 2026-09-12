import type { SeedShow, SeedEpisode } from "@/lib/mock/seed-data";
import { stripHtml, slugify, type TvProvider } from "@/lib/content/providers/types";

/**
 * TVmaze (https://www.tvmaze.com/api) — real TV metadata, no API key required.
 * Used as Aurora's live TV provider by default since no TMDB key is configured
 * in this environment; TMDB (see tmdb.ts) would take over automatically once
 * TMDB_API_KEY is set, since it covers both movies and TV from one source.
 */

interface TvMazeShow {
  id: number;
  name: string;
  genres: string[];
  premiered: string | null;
  rating: { average: number | null };
  image: { medium: string; original: string } | null;
  summary: string | null;
  network?: { name: string } | null;
  webChannel?: { name: string } | null;
  _embedded?: {
    episodes?: TvMazeEpisode[];
    cast?: { person: { name: string } }[];
  };
}

interface TvMazeEpisode {
  season: number;
  number: number | null;
  name: string;
  summary: string | null;
  runtime: number | null;
  rating: { average: number | null };
  image: { medium: string; original: string } | null;
}

const MOOD_BY_GENRE: Record<string, string[]> = {
  Drama: ["Melancholic", "Emotion-focused"],
  Crime: ["Tense", "Dark"],
  Thriller: ["Tense", "Intense"],
  Comedy: ["Uplifting", "Whimsical"],
  "Science-Fiction": ["Atmospheric", "Dreamy"],
  Horror: ["Dark", "Tense"],
  Fantasy: ["Dreamy", "Uplifting"],
  Action: ["Energetic", "Intense"],
  Mystery: ["Tense", "Dark"],
  Romance: ["Nostalgic", "Uplifting"],
  Adventure: ["Energetic", "Uplifting"],
  Documentary: ["Calm", "Atmospheric"],
};

function moodsForGenres(genres: string[]): string[] {
  const set = new Set<string>();
  for (const g of genres) {
    for (const m of MOOD_BY_GENRE[g] ?? []) set.add(m);
  }
  if (set.size === 0) set.add("Atmospheric");
  return [...set];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function mapShow(show: TvMazeShow): SeedShow {
  const episodesRaw = show._embedded?.episodes?.filter((e) => e.number != null) ?? [];
  const seasonCount = episodesRaw.reduce((max, e) => Math.max(max, e.season), 1);
  const cast = (show._embedded?.cast ?? []).slice(0, 6).map((c) => c.person.name);
  const genres = show.genres.length > 0 ? show.genres : ["Drama"];

  const episodes: SeedEpisode[] = episodesRaw.slice(0, 30).map((e) => ({
    season: e.season,
    episodeNumber: e.number as number,
    title: e.name,
    overview: stripHtml(e.summary) || "No synopsis available.",
    runtimeMin: e.runtime ?? 45,
    communityRating: e.rating?.average ?? show.rating?.average ?? 0,
    ratingCount: Math.round(200 + (e.rating?.average ?? 5) * 137),
    stillUrl: e.image?.original ?? e.image?.medium,
  }));

  return {
    slug: `${slugify(show.name)}-${show.id}`,
    title: show.name,
    tagline: show.network?.name ? `Originally aired on ${show.network.name}` : "",
    overview: stripHtml(show.summary) || "No synopsis available.",
    firstAirYear: show.premiered ? new Date(show.premiered).getFullYear() : 2020,
    seasonCount,
    creator: show.network?.name ?? show.webChannel?.name ?? "Independent",
    cast,
    genres,
    moods: moodsForGenres(genres),
    popularity: Math.round((show.rating?.average ?? 5) * 10),
    communityRating: show.rating?.average ?? 0,
    ratingCount: Math.round(500 + (show.rating?.average ?? 5) * 431),
    episodes: episodes.length > 0 ? episodes : placeholderEpisode(),
    posterUrl: show.image?.original ?? show.image?.medium,
    backdropUrl: show.image?.original ?? show.image?.medium,
  };
}

function placeholderEpisode(): SeedEpisode[] {
  return [
    {
      season: 1,
      episodeNumber: 1,
      title: "Pilot",
      overview: "No synopsis available.",
      runtimeMin: 45,
      communityRating: 0,
      ratingCount: 0,
    },
  ];
}

export const tvmazeProvider: TvProvider = {
  name: "TVmaze",
  isAvailable: () => true,
  async fetchShows(titles: string[]): Promise<SeedShow[]> {
    const results: SeedShow[] = [];
    for (const title of titles) {
      const show = await fetchJson<TvMazeShow>(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}&embed[]=episodes&embed[]=cast`
      );
      if (show) results.push(mapShow(show));
    }
    return results;
  },
};
