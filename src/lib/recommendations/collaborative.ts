import { cache } from "react";
import { prisma } from "@/lib/db/prisma";

/** `${ContentType}:${contentId}` — the same key shape used to index candidates for collaborative scoring. */
export type ItemKey = string;

export function itemKey(contentType: string, contentId: string): ItemKey {
  return `${contentType}:${contentId}`;
}

interface ItemRatings {
  raters: Map<string, number>; // userId -> score
}

export interface CollaborativeModel {
  itemRatings: Map<ItemKey, ItemRatings>;
  /** An item needs at least this many raters before its co-rating pattern is trusted as signal. */
  minRatersForSignal: number;
}

/**
 * Item-item collaborative filtering, built from every user's ratings (not just
 * the current one). This is the foundation the task list asks for: with a
 * small seed database it mostly contributes ~0 (see minRatersForSignal below)
 * and the hybrid ranker falls back to content-based + popularity, exactly
 * like the cold-start case — but the moment enough users rate overlapping
 * content, this starts contributing real signal with no code changes needed
 * elsewhere. hybrid.ts blends its score in alongside content-based/popularity.
 */
async function buildCollaborativeModelUncached(): Promise<CollaborativeModel> {
  const allRatings = await prisma.rating.findMany({
    select: { userId: true, contentType: true, contentId: true, score: true },
  });

  const itemRatings = new Map<ItemKey, ItemRatings>();
  for (const r of allRatings) {
    const key = itemKey(r.contentType, r.contentId);
    let entry = itemRatings.get(key);
    if (!entry) {
      entry = { raters: new Map() };
      itemRatings.set(key, entry);
    }
    entry.raters.set(r.userId, r.score);
  }

  return { itemRatings, minRatersForSignal: 3 };
}

/** Cosine similarity between two items' co-rater vectors (rating value per shared rater). */
function coRaterSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [userId, scoreA] of a) {
    normA += scoreA * scoreA;
    const scoreB = b.get(userId);
    if (scoreB !== undefined) dot += scoreA * scoreB;
  }
  for (const scoreB of b.values()) normB += scoreB * scoreB;

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * How well a candidate matches this user's taste based on *other users'*
 * co-rating patterns: items that tend to be rated similarly by the same
 * people as the items this user already rated highly score higher.
 */
export function scoreCollaborative(
  candidateKey: ItemKey,
  userRatings: { key: ItemKey; score: number }[],
  model: CollaborativeModel
): number {
  const candidate = model.itemRatings.get(candidateKey);
  if (!candidate || candidate.raters.size < model.minRatersForSignal) return 0;

  let total = 0;
  for (const { key, score } of userRatings) {
    if (key === candidateKey) continue;
    const rated = model.itemRatings.get(key);
    if (!rated) continue;
    const similarity = coRaterSimilarity(candidate.raters, rated.raters);
    total += similarity * (score - 2.5);
  }
  return total;
}

async function getUserRatingKeysUncached(userId: string): Promise<{ key: ItemKey; score: number }[]> {
  const ratings = await prisma.rating.findMany({
    where: { userId },
    select: { contentType: true, contentId: true, score: true },
  });
  return ratings.map((r) => ({ key: itemKey(r.contentType, r.contentId), score: r.score }));
}

/**
 * Both of these are per-request memoized: a single page can build several
 * rails plus One Perfect Pick, and each one needs the same model. Without
 * this, buildCollaborativeModel re-reads *every* rating row in the database
 * once per caller — which is what pushed Home past a 30s timeout once the
 * catalog and rating count grew.
 */
export const buildCollaborativeModel = cache(buildCollaborativeModelUncached);
export const getUserRatingKeys = cache(getUserRatingKeysUncached);
