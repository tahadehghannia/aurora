import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { created, noContent, unauthorized, notFound, forbidden, handleApi } from "@/lib/api/response";

const itemSchema = z.object({ songId: z.string().min(1) });

async function assertOwnership(playlistId: string, userId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist) return { error: notFound("Playlist not found.") };
  if (playlist.userId !== userId) return { error: forbidden("This isn't your playlist.") };
  return { playlist };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const { error } = await assertOwnership(id, userId);
    if (error) return error;

    const { songId } = itemSchema.parse(await request.json());

    const maxPosition = await prisma.playlistItem.aggregate({
      where: { playlistId: id },
      _max: { position: true },
    });

    const item = await prisma.playlistItem.upsert({
      where: { playlistId_songId: { playlistId: id, songId } },
      update: {},
      create: { playlistId: id, songId, position: (maxPosition._max.position ?? -1) + 1 },
    });

    await prisma.playlist.update({ where: { id }, data: { updatedAt: new Date() } });

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

    const { songId } = itemSchema.parse(await request.json());

    await prisma.playlistItem.deleteMany({ where: { playlistId: id, songId } });

    return noContent();
  });
}
