import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE, type ContentKind } from "@/types/content";
import type { ContentCard } from "@/types/content";

export interface JournalEntry {
  id: string;
  kind: "watched" | "listened" | "rated" | "saved";
  card: ContentCard;
  score?: number;
  at: Date;
}

export type JournalFilter = "all" | "movie" | "tv_show" | "music";

const MEDIA_KINDS: Record<Exclude<JournalFilter, "all">, ContentKind[]> = {
  movie: ["movie"],
  tv_show: ["tv_show", "episode"],
  music: ["artist", "album", "song"],
};

const PAGE_SIZE = 40;

/**
 * A chronological, first-person log of the user's own watch/listen/rate/save
 * events — the Entertainment Journal. Distinct from Friends Activity (which
 * is about *other* users): this is the user's own history, filterable by
 * media type, most recent first.
 */
export async function getJournal(userId: string, filter: JournalFilter = "all"): Promise<JournalEntry[]> {
  const [watch, listen, ratings, saved] = await Promise.all([
    prisma.watchHistory.findMany({ where: { userId }, orderBy: { watchedAt: "desc" }, take: PAGE_SIZE }),
    prisma.listeningHistory.findMany({ where: { userId }, orderBy: { playedAt: "desc" }, take: PAGE_SIZE }),
    prisma.rating.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: PAGE_SIZE }),
    prisma.savedItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: PAGE_SIZE }),
  ]);

  const rows: { id: string; kind: JournalEntry["kind"]; contentType: string; contentId: string; at: Date; score?: number }[] = [
    ...watch.map((w) => ({ id: `watch-${w.id}`, kind: "watched" as const, contentType: w.contentType, contentId: w.contentId, at: w.watchedAt })),
    ...listen.map((l) => ({ id: `listen-${l.id}`, kind: "listened" as const, contentType: l.contentType, contentId: l.contentId, at: l.playedAt })),
    ...ratings.map((r) => ({ id: `rating-${r.id}`, kind: "rated" as const, contentType: r.contentType, contentId: r.contentId, at: r.createdAt, score: r.score })),
    ...saved.map((s) => ({ id: `saved-${s.id}`, kind: "saved" as const, contentType: s.contentType, contentId: s.contentId, at: s.createdAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const kindFilter = filter === "all" ? null : new Set(MEDIA_KINDS[filter]);

  const entries: JournalEntry[] = [];
  for (const row of rows) {
    const kind = CONTENT_KIND_FROM_TYPE[row.contentType];
    if (kindFilter && !kindFilter.has(kind)) continue;
    const card = await getCardByKindAndId(kind, row.contentId);
    if (!card) continue;
    entries.push({ id: row.id, kind: row.kind, card, score: row.score, at: row.at });
    if (entries.length >= 30) break;
  }

  return entries;
}
