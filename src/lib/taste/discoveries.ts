import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";
import type { ContentCard } from "@/types/content";
import { getEntertainmentDNA } from "@/lib/taste/dna";

const RECENT_WINDOW_DAYS = 21;
const LIMIT = 8;

/**
 * "Recent Discoveries" — real content the user rated or saved recently
 * whose genres fall *outside* their established top-3 all-time genres.
 * This is a genuine "Aurora helped you find something new" signal, not
 * just a recency feed (that's the Journal) — it specifically surfaces
 * items that broaden the user's pattern rather than repeat it.
 */
export async function getRecentDiscoveries(userId: string): Promise<ContentCard[]> {
  const [dna, since] = await Promise.all([getEntertainmentDNA(userId), Promise.resolve(new Date())]);
  since.setDate(since.getDate() - RECENT_WINDOW_DAYS);

  const establishedGenres = new Set(dna.favoriteGenres.slice(0, 3).map((g) => g.name));
  if (establishedGenres.size === 0) return [];

  const [recentRatings, recentSaved] = await Promise.all([
    prisma.rating.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } }),
    prisma.savedItem.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } }),
  ]);

  const seen = new Set<string>();
  const results: ContentCard[] = [];

  for (const row of [...recentRatings, ...recentSaved]) {
    const key = `${row.contentType}:${row.contentId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const card = await getCardByKindAndId(CONTENT_KIND_FROM_TYPE[row.contentType], row.contentId);
    if (!card) continue;

    const genres = card.genres ?? [];
    const isNewTerritory = genres.length > 0 && genres.every((g) => !establishedGenres.has(g));
    if (isNewTerritory) results.push(card);

    if (results.length >= LIMIT) break;
  }

  return results;
}
