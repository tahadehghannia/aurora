import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { updateProfileSchema } from "@/lib/validation/profile";
import { ok, notFound, unauthorized, handleApi } from "@/lib/api/response";

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  createdAt: true,
  profile: true,
  preference: true,
} as const;

export async function GET() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) return notFound("User not found.");

    return ok(user);
  });
}

export async function PATCH(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const input = updateProfileSchema.parse(await request.json());

    const [user] = await prisma.$transaction([
      input.name
        ? prisma.user.update({ where: { id: userId }, data: { name: input.name }, select: { id: true, name: true } })
        : prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true } }),
      prisma.profile.update({
        where: { userId },
        data: {
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
          ...(input.showRatingsPublicly !== undefined ? { showRatingsPublicly: input.showRatingsPublicly } : {}),
          ...(input.showActivityPublicly !== undefined ? { showActivityPublicly: input.showActivityPublicly } : {}),
          ...(input.showCollectionsPublicly !== undefined ? { showCollectionsPublicly: input.showCollectionsPublicly } : {}),
          ...(input.showTasteDataPublicly !== undefined ? { showTasteDataPublicly: input.showTasteDataPublicly } : {}),
        },
      }),
    ]);

    return ok(user);
  });
}
