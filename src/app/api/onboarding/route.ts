import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { RELATION_KEY } from "@/lib/content/relation-key";
import { CONTENT_TYPE_MAP } from "@/types/content";
import { deriveTasteTraits } from "@/lib/recommendations/traits";
import { recalculateCommunityRating } from "@/lib/content/rating-aggregate";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const input = onboardingSchema.parse(await request.json());

    await prisma.userPreference.upsert({
      where: { userId },
      update: {
        contentTypes: input.contentTypes,
        favoriteMoods: input.moods,
        recommendationDiversity: input.recommendationDiversity,
      },
      create: {
        userId,
        contentTypes: input.contentTypes,
        favoriteMoods: input.moods,
        recommendationDiversity: input.recommendationDiversity,
      },
    });

    const genres = await prisma.genre.findMany({ where: { name: { in: input.genres } } });
    await prisma.$transaction(
      genres.map((genre) =>
        prisma.userGenre.upsert({
          where: { userId_genreId: { userId, genreId: genre.id } },
          update: { weight: 2 },
          create: { userId, genreId: genre.id, weight: 2 },
        })
      )
    );

    for (const fav of input.favorites) {
      await prisma.rating.upsert({
        where: {
          userId_contentType_contentId: {
            userId,
            contentType: CONTENT_TYPE_MAP[fav.kind] as never,
            contentId: fav.contentId,
          },
        },
        update: { score: 5 },
        create: {
          userId,
          contentType: CONTENT_TYPE_MAP[fav.kind] as never,
          contentId: fav.contentId,
          score: 5,
          [RELATION_KEY[fav.kind]]: fav.contentId,
        } as never,
      });
      await recalculateCommunityRating(fav.kind, fav.contentId);
    }

    const tasteTraits = deriveTasteTraits(input.genres);

    await prisma.profile.update({
      where: { userId },
      data: { onboardingCompleted: true, tasteTraits },
    });

    return ok({ tasteTraits });
  });
}
