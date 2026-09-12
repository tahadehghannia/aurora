import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { ok, noContent, unauthorized, notFound, forbidden, handleApi } from "@/lib/api/response";

const updatePlaylistSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(280).optional(),
  isPublic: z.boolean().optional(),
});

async function loadOwned(id: string, userId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id } });
  if (!playlist) return { error: notFound("Playlist not found.") };
  if (playlist.userId !== userId) return { error: forbidden("This isn't your playlist.") };
  return { playlist };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: { song: { include: { artist: true, album: true } } },
        },
      },
    });

    if (!playlist) return notFound("Playlist not found.");
    if (playlist.userId !== userId && !playlist.isPublic) return forbidden("This playlist is private.");

    return ok(playlist);
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const { error } = await loadOwned(id, userId);
    if (error) return error;

    const input = updatePlaylistSchema.parse(await request.json());
    const playlist = await prisma.playlist.update({ where: { id }, data: input });

    return ok(playlist);
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const { error } = await loadOwned(id, userId);
    if (error) return error;

    await prisma.playlist.delete({ where: { id } });
    return noContent();
  });
}
