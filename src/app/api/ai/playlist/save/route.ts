import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { created, unauthorized, handleApi } from "@/lib/api/response";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  songIds: z.array(z.string().min(1)).min(1).max(50),
});

/** Persists a previously-generated playlist preview into a real Playlist in the user's Library. */
export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { title, description, songIds } = bodySchema.parse(await request.json());

    const playlist = await prisma.playlist.create({
      data: {
        userId,
        title,
        description,
        items: {
          create: songIds.map((songId, position) => ({ songId, position })),
        },
      },
      include: { _count: { select: { items: true } } },
    });

    return created(playlist);
  });
}
