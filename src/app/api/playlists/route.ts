import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { ok, created, unauthorized, handleApi } from "@/lib/api/response";

const createPlaylistSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).optional(),
  isPublic: z.boolean().default(false),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const songId = searchParams.get("songId");

    const playlists = await prisma.playlist.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { items: true } } },
    });

    if (!songId) {
      return ok(playlists.map((p) => ({ ...p, hasItem: undefined })));
    }

    const memberships = await prisma.playlistItem.findMany({
      where: { playlistId: { in: playlists.map((p) => p.id) }, songId },
      select: { playlistId: true },
    });
    const memberSet = new Set(memberships.map((m) => m.playlistId));

    return ok(playlists.map((p) => ({ ...p, hasItem: memberSet.has(p.id) })));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const input = createPlaylistSchema.parse(await request.json());
    const playlist = await prisma.playlist.create({ data: { ...input, userId } });

    return created(playlist);
  });
}
