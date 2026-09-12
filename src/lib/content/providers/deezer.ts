import type { SeedArtist, SeedAlbum, SeedSong } from "@/lib/mock/seed-data";
import { slugify, type MusicProvider } from "@/lib/content/providers/types";

/**
 * Deezer's public API (https://developers.deezer.com) — real artist/album/
 * track metadata and artwork, no API key required. Preferred over iTunes
 * (itunes.ts) when both are available: Deezer exposes real artist photos,
 * real per-album genre tags, and real popularity signals (fan counts, track
 * rank) that iTunes's search API doesn't provide at all.
 */

interface DeezerArtist {
  id: number;
  name: string;
  picture_xl: string;
  nb_album: number;
  nb_fan: number;
}

interface DeezerAlbumSummary {
  id: number;
  title: string;
  cover_xl: string;
  release_date: string;
  fans: number;
}

interface DeezerAlbumDetail extends DeezerAlbumSummary {
  nb_tracks: number;
  genres?: { data: { name: string }[] };
}

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  rank: number;
}

interface DeezerList<T> {
  data: T[];
}

/**
 * Deezer's real per-genre/rank signals mapped into Aurora's mood
 * vocabulary — the same style of documented, fixed mapping used for TMDB
 * (see tmdb.ts's GENRE_MOOD_MAP), not per-item fabrication.
 */
const GENRE_MOOD_MAP: Record<string, string[]> = {
  Pop: ["Uplifting", "Energetic"],
  Rock: ["Energetic", "Intense"],
  "Alternative": ["Melancholic", "Dreamy"],
  "Rap/Hip Hop": ["Energetic", "Intense"],
  "Dance": ["Energetic", "Euphoric"],
  Electro: ["Energetic", "Euphoric"],
  "R&B": ["Dreamy", "Euphoric"],
  Jazz: ["Calm", "Nostalgic"],
  Reggae: ["Calm", "Uplifting"],
  Folk: ["Calm", "Melancholic"],
  Classical: ["Calm", "Atmospheric"],
  Country: ["Nostalgic", "Uplifting"],
  Metal: ["Intense", "Dark"],
  Films_Games: ["Atmospheric"],
  Blues: ["Melancholic", "Nostalgic"],
  Indie: ["Melancholic", "Dreamy"],
};

function moodsForGenre(genre?: string): string[] {
  if (!genre) return ["Atmospheric"];
  return GENRE_MOOD_MAP[genre] ?? ["Atmospheric"];
}

// Deezer's public API rate-limits at ~50 requests / 5 seconds per IP. Every
// call is funneled through this queue, paced to ~7/sec, so bulk ingestion
// never trips it — no request is fired until its slot arrives.
const MIN_INTERVAL_MS = 145;
let queueTail: Promise<void> = Promise.resolve();

function throttledFetch<T>(url: string): Promise<T | null> {
  const run = async (): Promise<T | null> => {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 60 * 60 * 24 } });
      if (!res.ok) {
        console.warn(`[Deezer] ${res.status} for ${url}`);
        return null;
      }
      const json = (await res.json()) as T & { error?: { message: string } };
      if ((json as { error?: { message: string } }).error) {
        console.warn(`[Deezer] API error for ${url}:`, (json as { error?: { message: string } }).error?.message);
        return null;
      }
      return json;
    } catch (err) {
      console.warn(`[Deezer] network error for ${url}:`, err instanceof Error ? err.message : err);
      return null;
    }
  };

  const scheduled = queueTail.then(() => new Promise<void>((resolve) => setTimeout(resolve, MIN_INTERVAL_MS)));
  queueTail = scheduled;
  return scheduled.then(run);
}

/** Log-scaled 0-100 normalization for Deezer's unbounded fan/rank counts. */
function normalize(raw: number, ceilingLog: number): number {
  if (raw <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(raw + 1) / ceilingLog) * 100));
}

/**
 * Deezer has no star-rating system, so `communityRating` is derived from
 * the same real popularity signal as `popularity` (fan count / track rank),
 * mapped onto a 3.0-4.9 range — a documented proxy, not a fabricated
 * number, and clearly a *popularity* signal rather than a claim about
 * actual listener ratings.
 */
function popularityToRating(pct: number): number {
  return Math.round((3.0 + (pct / 100) * 1.9) * 10) / 10;
}

async function searchArtist(name: string): Promise<DeezerArtist | null> {
  const result = await throttledFetch<DeezerList<DeezerArtist>>(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`
  );
  return result?.data[0] ?? null;
}

async function fetchArtistAlbums(artistId: number, limit = 3): Promise<DeezerAlbumSummary[]> {
  const result = await throttledFetch<DeezerList<DeezerAlbumSummary>>(
    `https://api.deezer.com/artist/${artistId}/albums?limit=${limit}`
  );
  return result?.data ?? [];
}

async function fetchAlbumDetail(albumId: number): Promise<DeezerAlbumDetail | null> {
  return throttledFetch<DeezerAlbumDetail>(`https://api.deezer.com/album/${albumId}`);
}

async function fetchAlbumTracks(albumId: number, limit = 6): Promise<DeezerTrack[]> {
  const result = await throttledFetch<DeezerList<DeezerTrack>>(
    `https://api.deezer.com/album/${albumId}/tracks?limit=${limit}`
  );
  return result?.data ?? [];
}

async function buildArtistCatalog(
  artist: DeezerArtist
): Promise<{ artist: SeedArtist; albums: SeedAlbum[] }> {
  const artistSlug = `${slugify(artist.name)}-${artist.id}`;
  const artistPopularity = normalize(artist.nb_fan, 7); // ~10M fans -> ~100

  const albumSummaries = await fetchArtistAlbums(artist.id);
  const albums: SeedAlbum[] = [];
  const artistGenres = new Set<string>();

  for (const summary of albumSummaries) {
    const [detail, tracks] = await Promise.all([fetchAlbumDetail(summary.id), fetchAlbumTracks(summary.id)]);
    if (!detail || tracks.length === 0) continue;

    const genreName = detail.genres?.data[0]?.name;
    if (genreName) artistGenres.add(genreName);
    const moods = moodsForGenre(genreName);
    const albumPopularity = normalize(detail.fans, 5); // ~100k fans -> ~100

    const songs: SeedSong[] = tracks.map((t) => {
      const trackPopularity = normalize(t.rank, 6); // ~1M rank -> ~100
      return {
        title: t.title,
        durationSec: t.duration,
        moods,
        popularity: trackPopularity,
        communityRating: popularityToRating(trackPopularity),
        ratingCount: t.rank,
      };
    });

    albums.push({
      slug: `${artistSlug}-${slugify(detail.title)}-${detail.id}`,
      title: detail.title,
      artistSlug,
      releaseYear: detail.release_date ? new Date(detail.release_date).getFullYear() : new Date().getFullYear(),
      genres: genreName ? [genreName] : ["Pop"],
      moods,
      popularity: albumPopularity,
      communityRating: popularityToRating(albumPopularity),
      ratingCount: detail.fans,
      songs,
      coverUrl: detail.cover_xl,
    });
  }

  const primaryGenre = [...artistGenres][0];

  return {
    artist: {
      slug: artistSlug,
      name: artist.name,
      bio: `${artist.name} on Deezer${primaryGenre ? ` — primarily ${primaryGenre}` : ""}. ${artist.nb_album} albums, ${artist.nb_fan.toLocaleString()} fans.`,
      genres: artistGenres.size > 0 ? [...artistGenres] : ["Pop"],
      moods: moodsForGenre(primaryGenre),
      popularity: artistPopularity,
      imageUrl: artist.picture_xl,
    },
    albums,
  };
}

async function fetchChartArtistIds(limit: number): Promise<number[]> {
  const result = await throttledFetch<DeezerList<{ id: number }>>(`https://api.deezer.com/chart/0/artists?limit=${limit}`);
  return (result?.data ?? []).map((a) => a.id);
}

export const deezerProvider: MusicProvider = {
  name: "Deezer",
  isAvailable: () => true,
  async fetchArtists(names: string[]) {
    const artists: SeedArtist[] = [];
    const albums: SeedAlbum[] = [];

    for (const name of names) {
      const found = await searchArtist(name);
      if (!found) continue;
      const catalog = await buildArtistCatalog(found);
      artists.push(catalog.artist);
      albums.push(...catalog.albums);
    }

    return { artists, albums };
  },

  /** Bulk ingestion from Deezer's real-time global artist chart, not a fixed title list. */
  async fetchPopular(count: number) {
    const ids = await fetchChartArtistIds(count);
    const artists: SeedArtist[] = [];
    const albums: SeedAlbum[] = [];

    for (const id of ids) {
      const detail = await throttledFetch<DeezerArtist>(`https://api.deezer.com/artist/${id}`);
      if (!detail) continue;
      const catalog = await buildArtistCatalog(detail);
      artists.push(catalog.artist);
      albums.push(...catalog.albums);
    }

    return { artists, albums };
  },
};
