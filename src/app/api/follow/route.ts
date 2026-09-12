import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { created, noContent, unauthorized, apiError, handleApi } from "@/lib/api/response";

const bodySchema = z.object({ userId: z.string().min(1) });

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { userId: followingId } = bodySchema.parse(await request.json());
    if (followingId === userId) {
      return apiError("You can't follow yourself.", 400, "SELF_FOLLOW");
    }

    const follow = await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: userId, followingId } },
      update: {},
      create: { followerId: userId, followingId },
    });

    return created(follow);
  });
}

export async function DELETE(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { userId: followingId } = bodySchema.parse(await request.json());

    await prisma.follow.deleteMany({ where: { followerId: userId, followingId } });

    return noContent();
  });
}
