import "server-only";
import { prisma } from "@/lib/db/prisma";
import { CONTENT_TYPE_MAP, type ContentKind } from "@/types/content";

export async function getUserContentState(userId: string, kind: ContentKind, contentId: string) {
  const contentType = CONTENT_TYPE_MAP[kind] as never;

  const [saved, rating] = await Promise.all([
    prisma.savedItem.findUnique({
      where: { userId_contentType_contentId: { userId, contentType, contentId } },
    }),
    prisma.rating.findUnique({
      where: { userId_contentType_contentId: { userId, contentType, contentId } },
    }),
  ]);

  return { saved: !!saved, userScore: rating?.score ?? 0 };
}
