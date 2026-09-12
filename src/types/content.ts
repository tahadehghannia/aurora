export type ContentKind = "movie" | "tv_show" | "episode" | "artist" | "album" | "song";

export const contentKindSet: ReadonlySet<ContentKind> = new Set([
  "movie",
  "tv_show",
  "episode",
  "artist",
  "album",
  "song",
]);

/** Maps the UI-facing kind to the Prisma ContentType enum value. */
export const CONTENT_TYPE_MAP: Record<ContentKind, string> = {
  movie: "MOVIE",
  tv_show: "TV_SHOW",
  episode: "EPISODE",
  artist: "ARTIST",
  album: "ALBUM",
  song: "SONG",
};

export const CONTENT_KIND_FROM_TYPE: Record<string, ContentKind> = {
  MOVIE: "movie",
  TV_SHOW: "tv_show",
  EPISODE: "episode",
  ARTIST: "artist",
  ALBUM: "album",
  SONG: "song",
};

export const CONTENT_ROUTE: Record<ContentKind, string> = {
  movie: "movie",
  tv_show: "show",
  episode: "episode",
  artist: "artist",
  album: "album",
  song: "song",
};

/** Lightweight shape used everywhere cards are rendered (grids, carousels, search results). */
export interface ContentCard {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  year?: number;
  rating?: number;
  ratingCount?: number;
  popularity?: number;
  genres?: string[];
  moods?: string[];
  /** The artist behind this item (album/song), or the artist's own id — powers artist-affinity scoring. */
  artistId?: string;
  /** Director (movie) or show creator — powers creator-affinity scoring and "Favorite Creators". */
  creator?: string;
}

/** The named recommendation rails/sections the engine can produce — see recommendations/index.ts. */
export type RecommendationType =
  | "FOR_YOU"
  | "BECAUSE_YOU_LIKED"
  | "RECENT_ACTIVITY"
  | "SIMILAR_TO_FAVORITES"
  | "TRENDING_IN_TASTE"
  | "NEW_FOR_YOU"
  | "OUTSIDE_USUAL_TASTE"
  | "TONIGHT"
  | "MUSIC_FOR_YOU"
  | "MOVIES_FOR_YOU"
  | "SHOWS_FOR_YOU";

export interface RecommendedCard extends ContentCard {
  reason?: string;
  /** Multi-line "Why this?" checklist — each line independently grounded in real signal. */
  reasons?: string[];
  score?: number;
  recommendationType?: RecommendationType;
}
