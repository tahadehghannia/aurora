import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";

const RECENT_WINDOW_DAYS = 14;

export interface TasteSignal {
  /** genre name -> affinity weight */
  genreWeights: Map<string, number>;
  /** mood -> affinity weight */
  moodWeights: Map<string, number>;
  /** artist id -> affinity weight — drives "more from artists you like" and artist-based explanations */
  artistWeights: Map<string, number>;
  /** director/show-creator name -> affinity weight */
  directorWeights: Map<string, number>;
  /** cast member name -> affinity weight — from movie/show cast lists on rated/saved/watched titles */
  actorWeights: Map<string, number>;
  /** titles the user rated 4+ or saved, per kind, used to build "because you liked" explanations */
  likedTitles: { title: string; kind: string; genres: string[]; creator?: string; artistId?: string; score?: number }[];
  /** genre/mood affinity from ONLY the last 14 days of watch/listen activity — lets "Because you've recently been watching..." be a real, distinct claim from the all-time genreWeights/moodWeights above. */
  recentGenreWeights: Map<string, number>;
  recentMoodWeights: Map<string, number>;
  /** content ids already in the user's orbit — excluded from candidate pools */
  seen: { movieIds: Set<string>; showIds: Set<string>; albumIds: Set<string>; artistIds: Set<string> };
  /** `${ContentType}:${id}` keys the user said "less like this" about — ranked down, never excluded (that's what "Not for me" is for). */
  softDownranked: Set<string>;
  /** "Hide this creator" overrides — "director:<name>" or "artist:<id>" — candidates by these are filtered out. */
  mutedCreators: string[];
  hasSignal: boolean;
}

const CONTENT_INCLUDE = {
  movie: { include: { genres: true } },
  show: { include: { genres: true } },
  album: { include: { genres: true } },
  song: { include: { genres: true } },
  artist: true,
} as const;

type RatingOrSaved = {
  movieId: string | null;
  showId: string | null;
  albumId: string | null;
  songId: string | null;
  artistId: string | null;
  movie: { title: string; genres: { name: string }[]; moods: string[]; director: string | null; cast: string[] } | null;
  show: { title: string; genres: { name: string }[]; moods: string[]; creator: string | null; cast: string[] } | null;
  album: { title: string; genres: { name: string }[]; moods: string[]; artistId: string } | null;
  song: { title: string; genres: { name: string }[]; moods: string[]; artistId: string } | null;
  artist: { name: string; genres: string[]; moods: string[] } | null;
};

/**
 * Aggregates a user's ratings, saved items, and watch/listen history into
 * genre/mood/artist affinity weights the content-based scorer can use.
 * Every explicit or implicit signal we track feeds in here — this is the
 * single place "what does this user like" gets computed.
 */
async function buildTasteSignalUncached(userId: string): Promise<TasteSignal> {
  const [
    ratings,
    saved,
    watchHistory,
    listeningHistory,
    preference,
    genreAffinities,
    artistAffinities,
    dismissed,
    usefulMarks,
    lessLikeThis,
  ] = await Promise.all([
      prisma.rating.findMany({ where: { userId }, include: CONTENT_INCLUDE }),
      prisma.savedItem.findMany({ where: { userId }, include: CONTENT_INCLUDE }),
      prisma.watchHistory.findMany({
        where: { userId },
        include: { movie: { include: { genres: true } }, show: { include: { genres: true } } },
        take: 200,
      }),
      prisma.listeningHistory.findMany({
        where: { userId },
        include: { song: { include: { genres: true } }, album: { include: { genres: true } } },
        take: 200,
      }),
      prisma.userPreference.findUnique({ where: { userId } }),
      prisma.userGenre.findMany({ where: { userId }, include: { genre: true } }),
      prisma.userArtist.findMany({ where: { userId } }),
      prisma.userContentInteraction.findMany({
        where: { userId, interactionType: "DISMISS" },
        select: { contentType: true, contentId: true },
      }),
      prisma.userContentInteraction.findMany({
        where: { userId, interactionType: "CLICK" },
        select: { contentType: true, contentId: true },
      }),
      prisma.userFeedback.findMany({
        where: { userId, feedbackType: "LESS_LIKE_THIS", undoneAt: null },
        select: { contentType: true, contentId: true },
      }),
    ]);

  const genreWeights = new Map<string, number>();
  const moodWeights = new Map<string, number>();
  const artistWeights = new Map<string, number>();
  const directorWeights = new Map<string, number>();
  const actorWeights = new Map<string, number>();
  const recentGenreWeights = new Map<string, number>();
  const recentMoodWeights = new Map<string, number>();
  const softDownranked = new Set<string>();
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - RECENT_WINDOW_DAYS);
  const likedTitles: TasteSignal["likedTitles"] = [];
  const seen = {
    movieIds: new Set<string>(),
    showIds: new Set<string>(),
    albumIds: new Set<string>(),
    artistIds: new Set<string>(),
  };

  const bump = (map: Map<string, number>, key: string | undefined | null, amount: number) => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + amount);
  };

  for (const genreAffinity of genreAffinities) {
    bump(genreWeights, genreAffinity.genre.name, genreAffinity.weight * 2);
  }
  for (const artistAffinity of artistAffinities) {
    bump(artistWeights, artistAffinity.artistId, artistAffinity.weight * 2);
  }
  for (const mood of preference?.favoriteMoods ?? []) {
    bump(moodWeights, mood, 3);
  }

  const applyContent = (row: RatingOrSaved, weight: number, trackLiked: boolean, score?: number) => {
    if (row.movieId) seen.movieIds.add(row.movieId);
    if (row.showId) seen.showIds.add(row.showId);
    if (row.albumId) seen.albumIds.add(row.albumId);
    if (row.artistId) seen.artistIds.add(row.artistId);

    const content = row.movie ?? row.show ?? row.album ?? row.song ?? row.artist;
    if (!content) return;

    const genreNames = content.genres.map((g) => (typeof g === "string" ? g : g.name));
    const displayName = "title" in content ? content.title : content.name;

    for (const genre of genreNames) bump(genreWeights, genre, weight);
    for (const mood of content.moods) bump(moodWeights, mood, weight * 0.6);

    // Artist affinity: direct artist rows, or via the artistId on an album/song.
    if (row.artistId) bump(artistWeights, row.artistId, weight);
    else if (row.album) bump(artistWeights, row.album.artistId, weight * 0.8);
    else if (row.song) bump(artistWeights, row.song.artistId, weight * 0.8);

    if (row.movie?.director) bump(directorWeights, row.movie.director, weight);
    else if (row.show?.creator) bump(directorWeights, row.show.creator, weight);

    for (const actor of row.movie?.cast ?? row.show?.cast ?? []) bump(actorWeights, actor, weight * 0.5);

    if (trackLiked) {
      const creator = row.movie?.director ?? row.show?.creator ?? undefined;
      const artistId = row.artistId ?? (row.album ? row.album.artistId : row.song ? row.song.artistId : undefined);
      likedTitles.push({
        title: displayName,
        kind: row.movieId ? "movie" : row.showId ? "show" : row.albumId ? "album" : row.songId ? "song" : "artist",
        genres: genreNames,
        creator,
        artistId,
        score,
      });
    }
  };

  for (const rating of ratings) {
    const weight = rating.score - 2.5; // negative for low ratings, positive for high
    applyContent(rating, weight, rating.score >= 4, rating.score);
    if (rating.score >= 4 && rating.createdAt >= recentCutoff) {
      const content = rating.movie ?? rating.show ?? rating.album ?? rating.song ?? rating.artist;
      if (content) {
        for (const genre of content.genres) bump(recentGenreWeights, typeof genre === "string" ? genre : genre.name, 1.5);
        for (const mood of content.moods) bump(recentMoodWeights, mood, 1.5);
      }
    }
  }

  for (const item of saved) {
    applyContent(item, 1.5, true);
    if (item.createdAt >= recentCutoff) {
      const content = item.movie ?? item.show ?? item.album ?? item.song ?? item.artist;
      if (content) {
        for (const genre of content.genres) bump(recentGenreWeights, typeof genre === "string" ? genre : genre.name, 1.5);
        for (const mood of content.moods) bump(recentMoodWeights, mood, 1.5);
      }
    }
  }

  // "This recommendation was useful" — an explicit positive signal, folded
  // in like a lightweight save (not as strong, since it's a one-tap
  // affirmation rather than a deliberate save/rate action).
  for (const mark of usefulMarks) {
    const kind = CONTENT_KIND_FROM_TYPE[mark.contentType];
    const card = await getCardByKindAndId(kind, mark.contentId);
    if (!card) continue;
    for (const genre of card.genres ?? []) bump(genreWeights, genre, 1);
    for (const mood of card.moods ?? []) bump(moodWeights, mood, 0.6);
    if (card.artistId) bump(artistWeights, card.artistId, 1);
    if (card.creator) bump(directorWeights, card.creator, 1);
  }

  // "Less like this" — the *soft* negative. The item goes in
  // `softDownranked` (hybrid.ts damps its score), and its genres/moods take
  // a small negative nudge so similar content drifts down too. The spillover
  // is deliberately gentle — much weaker than a 1-star rating's -1.5 — since
  // the user rejected one title, not an entire genre, and nothing here is
  // ever hard-excluded the way "Not for me" is.
  for (const row of lessLikeThis) {
    if (!row.contentType || !row.contentId) continue;
    const kind = CONTENT_KIND_FROM_TYPE[row.contentType];
    const card = await getCardByKindAndId(kind, row.contentId);
    if (!card) continue;
    softDownranked.add(`${row.contentType}:${row.contentId}`);
    for (const genre of card.genres ?? []) bump(genreWeights, genre, -0.35);
    for (const mood of card.moods ?? []) bump(moodWeights, mood, -0.2);
    if (card.creator) bump(directorWeights, card.creator, -0.3);
  }

  // Implicit signal: what a user actually watches/listens to matters even
  // without an explicit rating — weighted lower than a rating or save.
  for (const watch of watchHistory) {
    if (watch.movieId) seen.movieIds.add(watch.movieId);
    if (watch.showId) seen.showIds.add(watch.showId);
    const content = watch.movie ?? watch.show;
    if (!content) continue;
    for (const genre of content.genres) bump(genreWeights, genre.name, 0.75);
    for (const mood of content.moods) bump(moodWeights, mood, 0.4);
    if (watch.movie?.director) bump(directorWeights, watch.movie.director, 0.5);
    else if (watch.show?.creator) bump(directorWeights, watch.show.creator, 0.5);
    for (const actor of watch.movie?.cast ?? watch.show?.cast ?? []) bump(actorWeights, actor, 0.3);

    if (watch.watchedAt >= recentCutoff) {
      for (const genre of content.genres) bump(recentGenreWeights, genre.name, 1);
      for (const mood of content.moods) bump(recentMoodWeights, mood, 1);
    }
  }

  for (const listen of listeningHistory) {
    if (listen.albumId) seen.albumIds.add(listen.albumId);
    const content = listen.song ?? listen.album;
    if (!content) continue;
    for (const genre of content.genres) bump(genreWeights, genre.name, 0.75);
    for (const mood of content.moods) bump(moodWeights, mood, 0.4);
    if (listen.song) bump(artistWeights, listen.song.artistId, 0.6);

    if (listen.playedAt >= recentCutoff) {
      for (const genre of content.genres) bump(recentGenreWeights, genre.name, 1);
      for (const mood of content.moods) bump(recentMoodWeights, mood, 1);
    }
  }

  // "Not interested" dismissals feed straight into `seen` — from the
  // recommender's perspective, a dismissed item is excluded exactly like
  // something the user already has in their orbit.
  for (const d of dismissed) {
    if (d.contentType === "MOVIE") seen.movieIds.add(d.contentId);
    else if (d.contentType === "TV_SHOW") seen.showIds.add(d.contentId);
    else if (d.contentType === "ALBUM") seen.albumIds.add(d.contentId);
    else if (d.contentType === "ARTIST") seen.artistIds.add(d.contentId);
  }

  // Explicit personalization overrides ("Mute genre", "Less/more like this
  // mood", "Hide creator") apply on top of the learned signal, last, so they
  // always win regardless of how strong the underlying behavioral weight is.
  for (const genre of preference?.mutedGenres ?? []) genreWeights.delete(genre);
  for (const mood of preference?.mutedMoods ?? []) moodWeights.delete(mood);
  for (const mood of preference?.boostedMoods ?? []) {
    if (moodWeights.has(mood)) moodWeights.set(mood, moodWeights.get(mood)! * 1.5);
    else moodWeights.set(mood, 2);
  }
  for (const creatorKey of preference?.mutedCreators ?? []) {
    if (creatorKey.startsWith("director:")) directorWeights.delete(creatorKey.slice("director:".length));
    else if (creatorKey.startsWith("artist:")) artistWeights.delete(creatorKey.slice("artist:".length));
  }

  const hasSignal = genreWeights.size > 0 || moodWeights.size > 0 || artistWeights.size > 0;

  return {
    genreWeights,
    moodWeights,
    artistWeights,
    directorWeights,
    actorWeights,
    likedTitles,
    recentGenreWeights,
    recentMoodWeights,
    seen,
    softDownranked,
    mutedCreators: preference?.mutedCreators ?? [],
    hasSignal,
  };
}

/**
 * React's per-request memoization — a single request often needs the taste
 * signal several times (recommendations, DNA, mood profile, stats, taste
 * match...); without this each call re-runs 7 Prisma queries from scratch.
 * Safe because a signal is only ever read within the request that computed
 * it, never cached across requests or users.
 */
export const buildTasteSignal = cache(buildTasteSignalUncached);
