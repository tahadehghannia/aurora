import type { ContentKind } from "@/types/content";

/** Maps a content kind to the polymorphic FK field used on Rating/SavedItem/WatchHistory rows. */
export const RELATION_KEY: Record<ContentKind, string> = {
  movie: "movieId",
  tv_show: "showId",
  episode: "episodeId",
  artist: "artistId",
  album: "albumId",
  song: "songId",
};
