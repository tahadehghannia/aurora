import type { SeedArtist, SeedAlbum, SeedSong } from "@/lib/mock/seed-data";
import { slugify, type MusicProvider } from "@/lib/content/providers/types";

/**
 * Spotify Web API (client-credentials flow — app-only, no user login).
 * Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET. Both the client
 * secret and the resulting access token stay server-side; nothing here is
 * ever sent to the browser. Falls back to the keyless iTunes provider when
 * credentials aren't configured (see providers/index.ts).
 */

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: { url: string }[];
}

interface SpotifyAlbum {
  id: string;
  name: string;
  release_date: string;
  images: { url: string }[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  popularity: number;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  }).catch(() => null);

  if (!res?.ok) return null;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

async function fetchJson<T>(url: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function moodsForGenres(genres: string[]): string[] {
  const lower = genres.join(" ").toLowerCase();
  const moods: string[] = [];
  if (lower.includes("ambient") || lower.includes("chill")) moods.push("Calm", "Dreamy");
  if (lower.includes("rock") || lower.includes("punk")) moods.push("Energetic", "Intense");
  if (lower.includes("indie") || lower.includes("folk")) moods.push("Melancholic", "Nostalgic");
  if (lower.includes("electronic") || lower.includes("dance")) moods.push("Euphoric", "Energetic");
  return moods.length > 0 ? [...new Set(moods)] : ["Atmospheric"];
}

export const spotifyProvider: MusicProvider = {
  name: "Spotify",
  isAvailable: () => !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
  async fetchArtists(names: string[]) {
    const token = await getAccessToken();
    if (!token) return { artists: [], albums: [] };

    const artists: SeedArtist[] = [];
    const albums: SeedAlbum[] = [];

    for (const name of names) {
      const search = await fetchJson<{ artists: { items: SpotifyArtist[] } }>(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`,
        token
      );
      const artist = search?.artists.items[0];
      if (!artist) continue;

      const artistSlug = `${slugify(artist.name)}-${artist.id}`;
      artists.push({
        slug: artistSlug,
        name: artist.name,
        bio: `${artist.name} on Spotify${artist.genres[0] ? ` — primarily ${artist.genres[0]}` : ""}.`,
        genres: artist.genres.length > 0 ? artist.genres.slice(0, 3) : ["Alternative"],
        moods: moodsForGenres(artist.genres),
        popularity: artist.popularity,
        imageUrl: artist.images[0]?.url,
      });

      const albumsData = await fetchJson<{ items: SpotifyAlbum[] }>(
        `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album&limit=3`,
        token
      );

      for (const album of albumsData?.items ?? []) {
        const tracksData = await fetchJson<{ items: SpotifyTrack[] }>(
          `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=6`,
          token
        );
        const songs: SeedSong[] = (tracksData?.items ?? []).map((t) => ({
          title: t.name,
          durationSec: Math.round(t.duration_ms / 1000),
          moods: moodsForGenres(artist.genres),
          popularity: t.popularity ?? artist.popularity,
          communityRating: 3.5 + Math.random() * 1.4,
          ratingCount: Math.round(200 + Math.random() * 3000),
        }));
        if (songs.length === 0) continue;

        albums.push({
          slug: `${artistSlug}-${slugify(album.name)}-${album.id}`,
          title: album.name,
          artistSlug,
          releaseYear: album.release_date ? new Date(album.release_date).getFullYear() : new Date().getFullYear(),
          genres: artist.genres.length > 0 ? artist.genres.slice(0, 2) : ["Alternative"],
          moods: moodsForGenres(artist.genres),
          popularity: artist.popularity,
          communityRating: 3.6 + Math.random() * 1.3,
          ratingCount: Math.round(300 + Math.random() * 5000),
          songs,
          coverUrl: album.images[0]?.url,
        });
      }
    }

    return { artists, albums };
  },
};
