import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal, type TasteSignal } from "@/lib/recommendations/signals";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";
import type { ContentCard } from "@/types/content";

export interface GenreComparisonBar {
  genre: string;
  /** Each side normalized against that person's own strongest genre — 0-100, so bar lengths are comparable in scale even though the raw weights aren't on the same axis. */
  you: number;
  them: number;
}

export interface TasteMatch {
  userId: string;
  name: string;
  username: string;
  image: string | null;
  matchPct: number;
  sharedGenres: string[];
  sharedArtists: string[];
  commonFavorites: { title: string; kind: string }[];
  discoverFromThem: ContentCard[];
  isFollowing: boolean;
  /** Top genres from either side, for the visual "you vs. them" comparison. */
  genreComparison: GenreComparisonBar[];
}

/** Cosine similarity between two sparse weight maps, restricted to positive weights. */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  const keys = new Set([...a.keys()].filter((k) => (a.get(k) ?? 0) > 0));
  for (const k of b.keys()) if ((b.get(k) ?? 0) > 0) keys.add(k);
  if (keys.size === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const key of keys) {
    const va = Math.max(0, a.get(key) ?? 0);
    const vb = Math.max(0, b.get(key) ?? 0);
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function combinedSimilarity(a: TasteSignal, b: TasteSignal): number {
  const genreSim = cosineSimilarity(a.genreWeights, b.genreWeights);
  const artistSim = cosineSimilarity(a.artistWeights, b.artistWeights);
  const moodSim = cosineSimilarity(a.moodWeights, b.moodWeights);
  // Genre carries the most weight — it's the most stable, broadest signal;
  // artist and mood refine it.
  return genreSim * 0.5 + artistSim * 0.3 + moodSim * 0.2;
}

/**
 * Ranks other Aurora members by taste similarity (genre/artist/mood affinity
 * cosine similarity — the same vectors that drive personal recommendations),
 * not by follower counts. Only returns people whose accounts actually have
 * a computable taste signal; no similarity is invented for silent accounts.
 */
export async function getTasteMatches(userId: string, limit = 8): Promise<TasteMatch[]> {
  const [mySignal, others] = await Promise.all([
    buildTasteSignal(userId),
    prisma.user.findMany({
      where: { id: { not: userId }, profile: { isPublic: true } },
      select: { id: true, name: true, profile: { select: { username: true } }, image: true },
      take: 50,
    }),
  ]);

  if (!mySignal.hasSignal || others.length === 0) return [];

  const [otherSignals, myFollows] = await Promise.all([
    Promise.all(others.map((o) => buildTasteSignal(o.id))),
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
  ]);
  const followingIds = new Set(myFollows.map((f) => f.followingId));

  const scored = others
    .map((other, i) => ({ other, signal: otherSignals[i], score: combinedSimilarity(mySignal, otherSignals[i]) }))
    .filter((row) => row.signal.hasSignal && row.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const results: TasteMatch[] = [];

  for (const { other, signal, score } of scored) {
    const sharedGenres = [...mySignal.genreWeights.keys()]
      .filter((g) => (mySignal.genreWeights.get(g) ?? 0) > 0 && (signal.genreWeights.get(g) ?? 0) > 0)
      .sort((a, b) => (signal.genreWeights.get(b) ?? 0) - (signal.genreWeights.get(a) ?? 0))
      .slice(0, 4);

    // Comparison bars: top genres from either side, each normalized against
    // that person's own strongest genre so the two bars are on a comparable
    // 0-100 scale despite the raw weights not being directly comparable.
    const myMaxGenre = Math.max(1, ...[...mySignal.genreWeights.values()].filter((w) => w > 0));
    const theirMaxGenre = Math.max(1, ...[...signal.genreWeights.values()].filter((w) => w > 0));
    const myTopGenres = [...mySignal.genreWeights.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);
    const theirTopGenres = [...signal.genreWeights.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);
    const comparisonGenres = [...new Set([...myTopGenres, ...theirTopGenres])].slice(0, 5);
    const genreComparison = comparisonGenres.map((genre) => ({
      genre,
      you: Math.round(((mySignal.genreWeights.get(genre) ?? 0) / myMaxGenre) * 100),
      them: Math.round(((signal.genreWeights.get(genre) ?? 0) / theirMaxGenre) * 100),
    }));

    const sharedArtistIds = [...mySignal.artistWeights.keys()].filter(
      (id) => (mySignal.artistWeights.get(id) ?? 0) > 0 && (signal.artistWeights.get(id) ?? 0) > 0
    );
    const sharedArtistRows =
      sharedArtistIds.length > 0
        ? await prisma.artist.findMany({ where: { id: { in: sharedArtistIds.slice(0, 6) } }, select: { name: true } })
        : [];

    // Content both rated 4+.
    const [myLikes, theirLikes] = await Promise.all([
      prisma.rating.findMany({ where: { userId, score: { gte: 4 } }, select: { contentType: true, contentId: true } }),
      prisma.rating.findMany({ where: { userId: other.id, score: { gte: 4 } }, select: { contentType: true, contentId: true } }),
    ]);
    const myLikeKeys = new Set(myLikes.map((r) => `${r.contentType}:${r.contentId}`));
    const commonKeys = theirLikes
      .map((r) => ({ key: `${r.contentType}:${r.contentId}`, contentType: r.contentType, contentId: r.contentId }))
      .filter((r) => myLikeKeys.has(r.key));

    const commonFavorites = (
      await Promise.all(
        commonKeys.slice(0, 4).map((r) => getCardByKindAndId(CONTENT_KIND_FROM_TYPE[r.contentType], r.contentId))
      )
    )
      .filter((c): c is ContentCard => c !== null)
      .map((c) => ({ title: c.title, kind: c.kind }));

    // Things they loved that this user hasn't seen at all yet.
    const seenKeys = new Set([
      ...[...mySignal.seen.movieIds].map((id) => `MOVIE:${id}`),
      ...[...mySignal.seen.showIds].map((id) => `TV_SHOW:${id}`),
      ...[...mySignal.seen.albumIds].map((id) => `ALBUM:${id}`),
      ...[...mySignal.seen.artistIds].map((id) => `ARTIST:${id}`),
    ]);
    const unseenKeys = theirLikes
      .map((r) => ({ key: `${r.contentType}:${r.contentId}`, contentType: r.contentType, contentId: r.contentId }))
      .filter((r) => !seenKeys.has(r.key) && !commonKeys.some((c) => c.key === r.key));

    const discoverFromThem = (
      await Promise.all(
        unseenKeys.slice(0, 6).map((r) => getCardByKindAndId(CONTENT_KIND_FROM_TYPE[r.contentType], r.contentId))
      )
    ).filter((c): c is ContentCard => c !== null);

    if (!other.profile) continue;

    results.push({
      userId: other.id,
      name: other.name ?? other.profile.username,
      username: other.profile.username,
      image: other.image,
      matchPct: Math.round(score * 100),
      sharedGenres,
      sharedArtists: sharedArtistRows.map((a) => a.name),
      commonFavorites,
      discoverFromThem,
      isFollowing: followingIds.has(other.id),
      genreComparison,
    });
  }

  return results;
}
