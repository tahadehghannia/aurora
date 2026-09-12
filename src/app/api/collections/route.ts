import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { CONTENT_TYPE_MAP, contentKindSet } from "@/types/content";
import { ok, created, unauthorized, handleApi } from "@/lib/api/response";

const createCollectionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).optional(),
  isPublic: z.boolean().default(false),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const contentId = searchParams.get("contentId");

    const collections = await prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { items: true } } },
    });

    if (!kind || !contentId || !contentKindSet.has(kind as never)) {
      return ok(collections.map((c) => ({ ...c, hasItem: undefined })));
    }

    const memberships = await prisma.collectionItem.findMany({
      where: {
        collectionId: { in: collections.map((c) => c.id) },
        contentType: CONTENT_TYPE_MAP[kind as never] as never,
        contentId,
      },
      select: { collectionId: true },
    });
    const memberSet = new Set(memberships.map((m) => m.collectionId));

    return ok(collections.map((c) => ({ ...c, hasItem: memberSet.has(c.id) })));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const input = createCollectionSchema.parse(await request.json());
    const collection = await prisma.collection.create({ data: { ...input, userId } });

    return created(collection);
  });
}
