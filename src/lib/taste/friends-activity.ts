import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";
import { getTasteMatches } from "@/lib/taste/taste-match";
import type { ContentCard } from "@/types/content";

export interface FriendActivityItem {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  createdAt: Date;
  kind: "rated" | "saved" | "collection" | "playlist";
  card?: ContentCard;
  score?: number;
  title?: string;
}

const PER_USER_TAKE = 6;

/**
 * A feed of real, recent entertainment actions from people the user follows
 * — ratings, saves, new collections/playlists. If the user hasn't followed
 * anyone yet, falls back to their top taste matches so the feed still has
 * something to discover from (never a generic "no friends" dead end, and
 * never a fabricated action).
 */
export async function getFriendsActivity(userId: string, limit = 20): Promise<FriendActivityItem[]> {
  const follows = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  let sourceIds = follows.map((f) => f.followingId);

  if (sourceIds.length === 0) {
    const matches = await getTasteMatches(userId, 5);
    sourceIds = matches.map((m) => m.userId);
  }
  if (sourceIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: sourceIds }, profile: { isPublic: true } },
    select: { id: true, name: true, image: true, profile: { select: { username: true } } },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];

  const [ratings, saved, collections, playlists] = await Promise.all([
    prisma.rating.findMany({ where: { userId: { in: ids } }, orderBy: { createdAt: "desc" }, take: PER_USER_TAKE * ids.length }),
    prisma.savedItem.findMany({ where: { userId: { in: ids } }, orderBy: { createdAt: "desc" }, take: PER_USER_TAKE * ids.length }),
    prisma.collection.findMany({ where: { userId: { in: ids }, isPublic: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.playlist.findMany({ where: { userId: { in: ids }, isPublic: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const items: FriendActivityItem[] = [];

  for (const r of ratings) {
    const user = userById.get(r.userId);
    if (!user) continue;
    const card = await getCardByKindAndId(CONTENT_KIND_FROM_TYPE[r.contentType], r.contentId);
    if (!card) continue;
    items.push({
      id: `rating-${r.id}`,
      userId: r.userId,
      userName: user.name ?? user.profile?.username ?? "Someone",
      userImage: user.image,
      createdAt: r.createdAt,
      kind: "rated",
      card,
      score: r.score,
    });
  }

  for (const s of saved) {
    const user = userById.get(s.userId);
    if (!user) continue;
    const card = await getCardByKindAndId(CONTENT_KIND_FROM_TYPE[s.contentType], s.contentId);
    if (!card) continue;
    items.push({
      id: `saved-${s.id}`,
      userId: s.userId,
      userName: user.name ?? user.profile?.username ?? "Someone",
      userImage: user.image,
      createdAt: s.createdAt,
      kind: "saved",
      card,
    });
  }

  for (const c of collections) {
    const user = userById.get(c.userId);
    if (!user) continue;
    items.push({
      id: `collection-${c.id}`,
      userId: c.userId,
      userName: user.name ?? user.profile?.username ?? "Someone",
      userImage: user.image,
      createdAt: c.createdAt,
      kind: "collection",
      title: c.title,
    });
  }

  for (const p of playlists) {
    const user = userById.get(p.userId);
    if (!user) continue;
    items.push({
      id: `playlist-${p.id}`,
      userId: p.userId,
      userName: user.name ?? user.profile?.username ?? "Someone",
      userImage: user.image,
      createdAt: p.createdAt,
      kind: "playlist",
      title: p.title,
    });
  }

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}
