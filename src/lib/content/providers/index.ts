import { tmdbProvider } from "@/lib/content/providers/tmdb";
import { mockMovieProvider } from "@/lib/content/providers/mock";
import { tvmazeProvider } from "@/lib/content/providers/tvmaze";
import { itunesProvider } from "@/lib/content/providers/itunes";
import { deezerProvider } from "@/lib/content/providers/deezer";
import { spotifyProvider } from "@/lib/content/providers/spotify";
import type { MovieProvider, TvProvider, MusicProvider } from "@/lib/content/providers/types";

export { tmdbProvider, mockMovieProvider, tvmazeProvider, itunesProvider, deezerProvider, spotifyProvider };
export type { MovieProvider, TvProvider, MusicProvider };

/** Real TMDB data when TMDB_API_KEY is set, otherwise the fictional catalog. */
export function getMovieProvider(): MovieProvider {
  return tmdbProvider.isAvailable() ? tmdbProvider : mockMovieProvider;
}

/** TVmaze is real and keyless, so it's always the live TV provider. */
export function getTvProvider(): TvProvider {
  return tvmazeProvider;
}

/**
 * Spotify when credentials are set (richest metadata); otherwise Deezer —
 * also keyless and real, but with real artist photos, per-album genre tags,
 * and real popularity signals that the iTunes Search API doesn't expose.
 * iTunes stays available as an explicit fallback (see providers/itunes.ts)
 * but is no longer the default now that Deezer covers the same "keyless and
 * real" niche with richer data.
 */
export function getMusicProvider(): MusicProvider {
  if (spotifyProvider.isAvailable()) return spotifyProvider;
  return deezerProvider;
}
