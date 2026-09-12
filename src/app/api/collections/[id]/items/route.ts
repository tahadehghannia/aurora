import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { libraryItemSchema } from "@/lib/validation/content";
import { CONTENT_TYPE_MAP } from "@/types/content";
import { ok, created, noContent, unauthorized, notFound, forbidden, handleApi } from "@/lib/api/response";

async function assertOwnership(collectionId: string, userId: string) {
  const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
  if (!collection) return { error: notFound("Collection not found.") };
  if (collection.userId !== userId) return { error: forbidden("This isn't your collection.") };
  return { collection };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const { error } = await assertOwnership(id, userId);
    if (error) return error;

    const { kind, contentId } = libraryItemSchema.parse(await request.json());

    const maxPosition = await prisma.collectionItem.aggregate({
      where: { collectionId: id },
      _max: { position: true },
    });

    const item = await prisma.collectionItem.upsert({
      where: {
        collectionId_contentType_contentId: {
          collectionId: id,
          contentType: CONTENT_TYPE_MAP[kind] as never,
          contentId,
        },
      },
      update: {},
      create: {
        collectionId: id,
        contentType: CONTENT_TYPE_MAP[kind] as never,
        contentId,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    });

    await prisma.collection.update({ where: { id }, data: { updatedAt: new Date() } });

    return created(item);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const { error } = await assertOwnership(id, userId);
    if (error) return error;

    const { kind, contentId } = libraryItemSchema.parse(await request.json());

    await prisma.collectionItem.deleteMany({
      where: { collectionId: id, contentType: CONTENT_TYPE_MAP[kind] as never, contentId },
    });

    return noContent();
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const { error } = await assertOwnership(id, userId);
    if (error) return error;

    const items = await prisma.collectionItem.findMany({ where: { collectionId: id }, orderBy: { position: "asc" } });
    return ok(items);
  });
}
