import type { SeedMovie, SeedShow, SeedArtist, SeedAlbum } from "@/lib/mock/seed-data";

/**
 * Every content provider (real or mock) produces the same shapes the seed
 * script already knows how to upsert into Postgres. This is what makes
 * providers swappable: the sync script and the database don't care whether
 * the data came from TMDB, TVmaze, iTunes, Spotify, or the fictional catalog.
 */
export interface MovieProvider {
  name: string;
  isAvailable(): boolean;
  fetchMovies(titles: string[]): Promise<SeedMovie[]>;
  /** Bulk ingestion by popularity/quality rather than a specific title list — not every provider supports this. */
  fetchPopular?(count: number): Promise<SeedMovie[]>;
}

export interface TvProvider {
  name: string;
  isAvailable(): boolean;
  fetchShows(titles: string[]): Promise<SeedShow[]>;
}

export interface MusicProvider {
  name: string;
  isAvailable(): boolean;
  fetchArtists(names: string[]): Promise<{ artists: SeedArtist[]; albums: SeedAlbum[] }>;
  /** Bulk ingestion by chart/popularity rather than a specific artist list — not every provider supports this. */
  fetchPopular?(count: number): Promise<{ artists: SeedArtist[]; albums: SeedAlbum[] }>;
}

export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
