import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { ratingSchema, libraryItemSchema } from "@/lib/validation/content";
import { RELATION_KEY } from "@/lib/content/relation-key";
import { CONTENT_TYPE_MAP, CONTENT_KIND_FROM_TYPE } from "@/types/content";
import { getCardByKindAndId } from "@/lib/content/queries";
import { ok, created, noContent, unauthorized, handleApi } from "@/lib/api/response";
import { recalculateCommunityRating } from "@/lib/content/rating-aggregate";

export async function GET() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const ratings = await prisma.rating.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });

    const cards = await Promise.all(
      ratings.map(async (r) => ({
        ...(await getCardByKindAndId(CONTENT_KIND_FROM_TYPE[r.contentType], r.contentId)),
        userScore: r.score,
      }))
    );

    return ok(cards.filter((c) => c.id));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { kind, contentId, score } = ratingSchema.parse(await request.json());
    const relationField = RELATION_KEY[kind];

    const rating = await prisma.rating.upsert({
      where: {
        userId_contentType_contentId: { userId, contentType: CONTENT_TYPE_MAP[kind] as never, contentId },
      },
      update: { score },
      create: {
        userId,
        contentType: CONTENT_TYPE_MAP[kind] as never,
        contentId,
        score,
        [relationField]: contentId,
      } as never,
    });

    await recalculateCommunityRating(kind, contentId);

    return created(rating);
  });
}

export async function DELETE(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { kind, contentId } = libraryItemSchema.parse(await request.json());

    await prisma.rating.deleteMany({ where: { userId, contentType: CONTENT_TYPE_MAP[kind] as never, contentId } });
    await recalculateCommunityRating(kind, contentId);

    return noContent();
  });
}
