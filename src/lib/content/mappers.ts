import type { Movie, TVShow, Episode, Artist, Album, Song, Genre } from "@/generated/prisma/client";
import type { ContentCard } from "@/types/content";

type MovieWithGenres = Movie & { genres?: Genre[] };
type ShowWithGenres = TVShow & { genres?: Genre[] };
type AlbumWithGenres = Album & { genres?: Genre[]; artist?: Artist };
type SongWithRelations = Song & { genres?: Genre[]; artist?: Artist; album?: Album | null };
type EpisodeWithShow = Episode & { show?: TVShow };

export function movieToCard(m: MovieWithGenres): ContentCard {
  return {
    id: m.id,
    kind: "movie",
    slug: m.slug,
    title: m.title,
    subtitle: String(m.releaseYear),
    imageUrl: m.posterUrl,
    year: m.releaseYear,
    rating: m.communityRating,
    ratingCount: m.ratingCount,
    popularity: m.popularity,
    genres: m.genres?.map((g) => g.name),
    moods: m.moods,
    creator: m.director ?? undefined,
  };
}

export function showToCard(s: ShowWithGenres): ContentCard {
  return {
    id: s.id,
    kind: "tv_show",
    slug: s.slug,
    title: s.title,
    subtitle: String(s.firstAirYear),
    imageUrl: s.posterUrl,
    year: s.firstAirYear,
    rating: s.communityRating,
    ratingCount: s.ratingCount,
    popularity: s.popularity,
    genres: s.genres?.map((g) => g.name),
    moods: s.moods,
    creator: s.creator ?? undefined,
  };
}

export function episodeToCard(e: EpisodeWithShow): ContentCard {
  return {
    id: e.id,
    kind: "episode",
    slug: e.slug,
    title: e.title,
    subtitle: e.show ? `${e.show.title} · S${e.season}E${e.episodeNumber}` : `S${e.season}E${e.episodeNumber}`,
    imageUrl: e.stillUrl ?? e.show?.posterUrl ?? "",
    rating: e.communityRating,
    ratingCount: e.ratingCount,
  };
}

export function artistToCard(a: Artist): ContentCard {
  return {
    id: a.id,
    kind: "artist",
    slug: a.slug,
    title: a.name,
    subtitle: a.genres[0],
    imageUrl: a.imageUrl,
    popularity: a.popularity,
    genres: a.genres,
    moods: a.moods,
    artistId: a.id,
  };
}

export function albumToCard(al: AlbumWithGenres): ContentCard {
  return {
    id: al.id,
    kind: "album",
    slug: al.slug,
    title: al.title,
    subtitle: al.artist?.name,
    imageUrl: al.coverUrl,
    year: al.releaseYear,
    rating: al.communityRating,
    ratingCount: al.ratingCount,
    popularity: al.popularity,
    genres: al.genres?.map((g) => g.name),
    moods: al.moods,
    artistId: al.artistId,
  };
}

export function songToCard(s: SongWithRelations): ContentCard {
  return {
    id: s.id,
    kind: "song",
    slug: s.slug,
    title: s.title,
    subtitle: s.artist?.name,
    imageUrl: s.album?.coverUrl ?? "",
    rating: s.communityRating,
    ratingCount: s.ratingCount,
    popularity: s.popularity,
    genres: s.genres?.map((g) => g.name),
    moods: s.moods,
    artistId: s.artistId,
  };
}
