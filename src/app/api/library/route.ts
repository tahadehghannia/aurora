import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { libraryItemSchema, contentKindSchema } from "@/lib/validation/content";
import { RELATION_KEY } from "@/lib/content/relation-key";
import { CONTENT_TYPE_MAP, CONTENT_KIND_FROM_TYPE } from "@/types/content";
import { getCardByKindAndId } from "@/lib/content/queries";
import { ok, created, noContent, unauthorized, apiError, handleApi } from "@/lib/api/response";

export async function GET(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const rawKind = searchParams.get("kind");
    if (rawKind && !contentKindSchema.safeParse(rawKind).success) {
      return apiError(`Unknown content kind "${rawKind}".`, 400, "INVALID_KIND");
    }
    const kind = rawKind;

    const items = await prisma.savedItem.findMany({
      where: { userId, ...(kind ? { contentType: CONTENT_TYPE_MAP[kind as keyof typeof CONTENT_TYPE_MAP] as never } : {}) },
      orderBy: { createdAt: "desc" },
    });

    const cards = await Promise.all(
      items.map((item) => getCardByKindAndId(CONTENT_KIND_FROM_TYPE[item.contentType], item.contentId))
    );

    return ok(cards.filter((c) => c !== null));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { kind, contentId } = libraryItemSchema.parse(await request.json());

    const item = await prisma.savedItem.upsert({
      where: {
        userId_contentType_contentId: {
          userId,
          contentType: CONTENT_TYPE_MAP[kind] as never,
          contentId,
        },
      },
      update: {},
      create: {
        userId,
        contentType: CONTENT_TYPE_MAP[kind] as never,
        contentId,
        [RELATION_KEY[kind]]: contentId,
      },
    });

    return created(item);
  });
}

export async function DELETE(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { kind, contentId } = libraryItemSchema.parse(await request.json());

    await prisma.savedItem.deleteMany({
      where: { userId, contentType: CONTENT_TYPE_MAP[kind] as never, contentId },
    });

    return noContent();
  });
}
