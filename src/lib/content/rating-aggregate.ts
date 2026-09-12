import "server-only";
import { prisma } from "@/lib/db/prisma";
import { CONTENT_TYPE_MAP, type ContentKind } from "@/types/content";

const MODEL: Record<ContentKind, keyof typeof prisma> = {
  movie: "movie",
  tv_show: "tVShow",
  episode: "episode",
  artist: "artist",
  album: "album",
  song: "song",
};

/** Recomputes an item's community rating average + count after a user rating changes. */
export async function recalculateCommunityRating(kind: ContentKind, contentId: string) {
  const agg = await prisma.rating.aggregate({
    where: { contentType: CONTENT_TYPE_MAP[kind] as never, contentId },
    _avg: { score: true },
    _count: { score: true },
  });

  const modelDelegate = prisma[MODEL[kind]] as unknown as {
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };

  if (kind === "artist") {
    // Artist has no communityRating field — skip.
    return;
  }

  await modelDelegate.update({
    where: { id: contentId },
    data: {
      communityRating: agg._avg.score ?? 0,
      ratingCount: agg._count.score,
    },
  });
}
