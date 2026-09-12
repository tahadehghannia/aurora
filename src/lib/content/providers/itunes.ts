import type { SeedArtist, SeedAlbum, SeedSong } from "@/lib/mock/seed-data";
import { slugify, type MusicProvider } from "@/lib/content/providers/types";

/**
 * Apple's iTunes Search API (https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI)
 * — real music metadata and artwork, no API key required. Used as Aurora's
 * live music provider by default; Spotify (see spotify.ts) takes over
 * automatically once SPOTIFY_CLIENT_ID/SECRET are set.
 */

interface ItunesArtistResult {
  wrapperType: "artist";
  artistId: number;
  artistName: string;
  primaryGenreName?: string;
}

interface ItunesAlbumResult {
  wrapperType: "collection";
  collectionId: number;
  collectionName: string;
  artistId: number;
  artistName: string;
  artworkUrl100: string;
  releaseDate: string;
  primaryGenreName?: string;
  trackCount: number;
}

interface ItunesSongResult {
  wrapperType: "track";
  kind: "song";
  trackId: number;
  trackName: string;
  collectionId: number;
  trackTimeMillis?: number;
  primaryGenreName?: string;
}

interface ItunesResponse<T> {
  resultCount: number;
  results: T[];
}

const MOOD_BY_GENRE: Record<string, string[]> = {
  Rock: ["Energetic", "Intense"],
  Alternative: ["Experimental", "Melancholic"],
  Pop: ["Uplifting", "Energetic"],
  "Hip-Hop/Rap": ["Energetic", "Intense"],
  "R&B/Soul": ["Dreamy", "Euphoric"],
  Electronic: ["Energetic", "Euphoric"],
  Jazz: ["Calm", "Nostalgic"],
  Folk: ["Calm", "Melancholic"],
  "Singer/Songwriter": ["Melancholic", "Calm"],
  Ambient: ["Calm", "Dreamy"],
  Classical: ["Calm", "Atmospheric"],
  Country: ["Nostalgic", "Uplifting"],
  Indie: ["Melancholic", "Dreamy"],
};

function moodsForGenre(genre?: string): string[] {
  if (!genre) return ["Atmospheric"];
  return MOOD_BY_GENRE[genre] ?? ["Atmospheric"];
}

function upscaleArtwork(url: string, size = 800): string {
  return url.replace(/\d+x\d+bb\.(jpg|png)/, `${size}x${size}bb.$1`);
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

async function fetchArtist(name: string): Promise<ItunesArtistResult | null> {
  const data = await fetchJson<ItunesResponse<ItunesArtistResult>>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`
  );
  return data?.results[0] ?? null;
}

async function fetchAlbums(artistId: number, limit = 3): Promise<ItunesAlbumResult[]> {
  const data = await fetchJson<ItunesResponse<ItunesAlbumResult | ItunesArtistResult>>(
    `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=${limit + 1}`
  );
  return (data?.results.filter((r): r is ItunesAlbumResult => r.wrapperType === "collection") ?? []).slice(0, limit);
}

async function fetchSongs(albumId: number, limit = 5): Promise<ItunesSongResult[]> {
  const data = await fetchJson<ItunesResponse<ItunesSongResult | ItunesAlbumResult>>(
    `https://itunes.apple.com/lookup?id=${albumId}&entity=song&limit=${limit + 1}`
  );
  return (data?.results.filter((r): r is ItunesSongResult => r.wrapperType === "track") ?? []).slice(0, limit);
}

export const itunesProvider: MusicProvider = {
  name: "iTunes Search API",
  isAvailable: () => true,
  async fetchArtists(names: string[]) {
    const artists: SeedArtist[] = [];
    const albums: SeedAlbum[] = [];

    for (const name of names) {
      const artistResult = await fetchArtist(name);
      if (!artistResult) continue;

      const artistSlug = `${slugify(artistResult.artistName)}-${artistResult.artistId}`;
      const genre = artistResult.primaryGenreName;

      artists.push({
        slug: artistSlug,
        name: artistResult.artistName,
        bio: `${artistResult.artistName} on Apple Music${genre ? ` — primarily ${genre}` : ""}.`,
        genres: genre ? [genre] : ["Alternative"],
        moods: moodsForGenre(genre),
        popularity: 60 + Math.round(Math.random() * 30),
      });

      const albumResults = await fetchAlbums(artistResult.artistId);
      for (const album of albumResults) {
        const songResults = await fetchSongs(album.collectionId);
        const songs: SeedSong[] = songResults.map((s) => ({
          title: s.trackName,
          durationSec: Math.round((s.trackTimeMillis ?? 210000) / 1000),
          moods: moodsForGenre(s.primaryGenreName ?? genre),
          popularity: 50 + Math.round(Math.random() * 40),
          communityRating: 3.5 + Math.random() * 1.4,
          ratingCount: Math.round(200 + Math.random() * 3000),
        }));

        if (songs.length === 0) continue;

        albums.push({
          slug: `${artistSlug}-${slugify(album.collectionName)}-${album.collectionId}`,
          title: album.collectionName,
          artistSlug,
          releaseYear: album.releaseDate ? new Date(album.releaseDate).getFullYear() : new Date().getFullYear(),
          genres: album.primaryGenreName ? [album.primaryGenreName] : genre ? [genre] : ["Alternative"],
          moods: moodsForGenre(album.primaryGenreName ?? genre),
          popularity: 55 + Math.round(Math.random() * 35),
          communityRating: 3.6 + Math.random() * 1.3,
          ratingCount: Math.round(300 + Math.random() * 5000),
          songs,
          coverUrl: upscaleArtwork(album.artworkUrl100),
        });
      }
    }

    return { artists, albums };
  },
};
