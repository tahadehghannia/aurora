import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { contentKindSchema } from "@/lib/validation/content";
import { CONTENT_TYPE_MAP } from "@/types/content";
import { created, unauthorized, handleApi } from "@/lib/api/response";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  items: z.array(z.object({ kind: contentKindSchema, contentId: z.string().min(1) })).min(1).max(30),
});

/** Persists a previously-generated watchlist preview into a real Collection in the user's Library. */
export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { title, description, items } = bodySchema.parse(await request.json());

    const collection = await prisma.collection.create({
      data: {
        userId,
        title,
        description,
        items: {
          create: items.map((item, position) => ({
            contentType: CONTENT_TYPE_MAP[item.kind] as never,
            contentId: item.contentId,
            position,
          })),
        },
      },
      include: { _count: { select: { items: true } } },
    });

    return created(collection);
  });
}
