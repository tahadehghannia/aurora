import "server-only";
import { prisma } from "@/lib/db/prisma";

export interface Milestone {
  label: string;
  date: Date;
}

const RATING_MILESTONES = [500, 250, 100, 50, 25, 10];

/**
 * A handful of real, dated moments from the user's own history — not a
 * gamified achievement list. Each entry is backed by an actual row/count;
 * nothing here is awarded or simulated.
 */
export async function getMilestones(userId: string): Promise<Milestone[]> {
  const [firstRating, ratingCount, firstSave, firstCollection, firstPlaylist, firstWatch, firstListen] = await Promise.all([
    prisma.rating.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.rating.count({ where: { userId } }),
    prisma.savedItem.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.collection.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.playlist.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.watchHistory.findFirst({ where: { userId }, orderBy: { watchedAt: "asc" }, select: { watchedAt: true } }),
    prisma.listeningHistory.findFirst({ where: { userId }, orderBy: { playedAt: "asc" }, select: { playedAt: true } }),
  ]);

  const milestones: Milestone[] = [];

  if (firstRating) milestones.push({ label: "First rating", date: firstRating.createdAt });
  if (firstWatch) milestones.push({ label: "First watch", date: firstWatch.watchedAt });
  if (firstListen) milestones.push({ label: "First listen", date: firstListen.playedAt });
  if (firstSave) milestones.push({ label: "First save", date: firstSave.createdAt });
  if (firstCollection) milestones.push({ label: "First collection created", date: firstCollection.createdAt });
  if (firstPlaylist) milestones.push({ label: "First playlist created", date: firstPlaylist.createdAt });

  const crossedRatingMilestone = RATING_MILESTONES.find((n) => ratingCount >= n);
  if (crossedRatingMilestone) {
    // The exact crossing date isn't tracked, so this is dated to "now" only
    // implicitly via display order — callers should treat it as a running
    // total, not a dated event, and it's appended last for that reason.
    milestones.push({ label: `${crossedRatingMilestone}+ ratings given`, date: new Date() });
  }

  return milestones.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-4);
}
