import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE, CONTENT_TYPE_MAP, type ContentKind } from "@/types/content";
import { moodIntentSchema, type MoodIntent } from "@/lib/mood/intent";
import type { MoodReasonType } from "@/lib/mood/rank";
import type { GeneratedMoodWatchlist, MoodWatchlistItem } from "@/lib/mood/generate";
import type { PersonalizationLevel } from "@/lib/mood/compose";

/**
 * Persistence for mood watchlists (§25, §31).
 *
 * Stored lists keep their structured intent alongside the prose, so a saved
 * list can be regenerated or refined later from the same machine-readable
 * request rather than by re-parsing the original sentence.
 */

/** Bumped when the curation prompt changes, so older lists remain interpretable. */
export const PROMPT_VERSION = "1";

export interface StoredMoodWatchlist {
  id: string;
  title: string;
  description: string;
  whyThisList: string;
  prompt: string;
  intent: MoodIntent;
  exploration: string;
  personalization: PersonalizationLevel;
  aiCurated: boolean;
  createdAt: Date;
  items: MoodWatchlistItem[];
}

export async function saveMoodWatchlist(
  userId: string,
  generated: GeneratedMoodWatchlist,
  modelVersion: string | null
): Promise<string> {
  const created = await prisma.moodWatchlist.create({
    data: {
      userId,
      title: generated.title,
      description: generated.description,
      whyThisList: generated.whyThisList,
      prompt: generated.prompt,
      parsedIntent: generated.intent,
      exploration: generated.exploration,
      personalization: generated.personalization,
      aiCurated: generated.ai.curated,
      modelVersion,
      promptVersion: PROMPT_VERSION,
      items: {
        create: generated.items.map((item, position) => ({
          contentType: CONTENT_TYPE_MAP[item.card.kind] as never,
          contentId: item.card.id,
          position,
          reason: item.reason,
          reasonType: item.reasonType as never,
        })),
      },
    },
    select: { id: true },
  });
  return created.id;
}

/** Rehydrates a stored list, dropping items whose content has since disappeared. */
export async function getMoodWatchlist(userId: string, id: string): Promise<StoredMoodWatchlist | null> {
  const row = await prisma.moodWatchlist.findFirst({
    where: { id, userId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!row) return null;

  // Runtimes are re-read in one batch rather than dropped: a saved list should
  // still be able to say how long something runs (§21).
  const movieIds = row.items
    .filter((item) => item.contentType === "MOVIE")
    .map((item) => item.contentId);
  const runtimes = new Map(
    movieIds.length > 0
      ? (
          await prisma.movie.findMany({
            where: { id: { in: movieIds } },
            select: { id: true, runtimeMin: true },
          })
        ).map((m) => [m.id, m.runtimeMin])
      : []
  );

  const cards = await Promise.all(
    row.items.map(async (item): Promise<MoodWatchlistItem | null> => {
      const kind = CONTENT_KIND_FROM_TYPE[item.contentType] as ContentKind;
      const card = await getCardByKindAndId(kind, item.contentId);
      if (!card) return null;
      return {
        card,
        reason: item.reason,
        reasonType: item.reasonType as MoodReasonType,
        runtimeMin: runtimes.get(item.contentId) ?? null,
        year: card.year ?? 0,
      };
    })
  );

  const parsed = moodIntentSchema.safeParse(row.parsedIntent);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    whyThisList: row.whyThisList,
    prompt: row.prompt,
    intent: parsed.success ? parsed.data : moodIntentSchema.parse({}),
    exploration: row.exploration,
    personalization: row.personalization as PersonalizationLevel,
    aiCurated: row.aiCurated,
    createdAt: row.createdAt,
    items: cards.filter((c): c is MoodWatchlistItem => c !== null),
  };
}

export interface MoodWatchlistSummary {
  id: string;
  title: string;
  description: string;
  prompt: string;
  itemCount: number;
  createdAt: Date;
  aiCurated: boolean;
}

export async function listMoodWatchlists(userId: string, limit = 10): Promise<MoodWatchlistSummary[]> {
  const rows = await prisma.moodWatchlist.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { _count: { select: { items: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    prompt: row.prompt,
    itemCount: row._count.items,
    createdAt: row.createdAt,
    aiCurated: row.aiCurated,
  }));
}

export async function renameMoodWatchlist(userId: string, id: string, title: string): Promise<boolean> {
  const result = await prisma.moodWatchlist.updateMany({ where: { id, userId }, data: { title } });
  return result.count > 0;
}

export async function deleteMoodWatchlist(userId: string, id: string): Promise<boolean> {
  const result = await prisma.moodWatchlist.deleteMany({ where: { id, userId } });
  return result.count > 0;
}

/** Removes one item and closes the gap in positions so ordering stays dense. */
export async function removeMoodWatchlistItem(userId: string, id: string, contentId: string): Promise<boolean> {
  const owned = await prisma.moodWatchlist.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return false;

  const deleted = await prisma.moodWatchlistItem.deleteMany({ where: { watchlistId: id, contentId } });
  if (deleted.count === 0) return false;

  const remaining = await prisma.moodWatchlistItem.findMany({
    where: { watchlistId: id },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((item, position) =>
      prisma.moodWatchlistItem.update({ where: { id: item.id }, data: { position } })
    )
  );
  return true;
}

/** Swaps one item for a replacement, keeping the rest of the list untouched (§26). */
export async function replaceMoodWatchlistItem(
  userId: string,
  id: string,
  outgoingContentId: string,
  incoming: { kind: ContentKind; contentId: string; reason: string; reasonType: MoodReasonType }
): Promise<boolean> {
  const existing = await prisma.moodWatchlistItem.findFirst({
    where: { watchlistId: id, contentId: outgoingContentId, watchlist: { userId } },
  });
  if (!existing) return false;

  await prisma.$transaction([
    prisma.moodWatchlistItem.delete({ where: { id: existing.id } }),
    prisma.moodWatchlistItem.create({
      data: {
        watchlistId: id,
        contentType: CONTENT_TYPE_MAP[incoming.kind] as never,
        contentId: incoming.contentId,
        position: existing.position,
        reason: incoming.reason,
        reasonType: incoming.reasonType as never,
      },
    }),
  ]);
  return true;
}
