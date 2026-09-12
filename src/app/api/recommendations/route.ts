import { getCurrentUserId } from "@/lib/auth/session";
import {
  getRecommendationsForUser,
  getBecauseYouLiked,
  getOutsideUsualTaste,
  getStructuredReasons,
} from "@/lib/recommendations";
import { contentKindSchema } from "@/lib/validation/content";
import { ok, unauthorized, apiError, handleApi } from "@/lib/api/response";
import type { ContentKind, RecommendationType, RecommendedCard } from "@/types/content";

const MAX_LIMIT = 50;

const TYPE_KIND_FILTER: Partial<Record<RecommendationType, ContentKind>> = {
  MOVIES_FOR_YOU: "movie",
  SHOWS_FOR_YOU: "tv_show",
};

/**
 * GET /api/recommendations?type=FOR_YOU&limit=12&contentType=movie&mood=Atmospheric
 *
 * Returns the clean, versioned recommendation contract — {id, content,
 * score, recommendationType, reasons[], generatedAt}[] — rather than the
 * raw internal card shape. Internal ranking/model details (contentScore,
 * collaborative model weights, diversify() tiering) never leave this
 * boundary.
 */
export async function GET(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);

    const rawLimit = Number(searchParams.get("limit") ?? 12);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT) : 12;

    const rawKind = searchParams.get("contentType") ?? searchParams.get("kind");
    if (rawKind && !contentKindSchema.safeParse(rawKind).success) {
      return apiError(`Unknown content kind "${rawKind}".`, 400, "INVALID_KIND");
    }
    const kind = (rawKind as ContentKind | null) ?? undefined;

    const rawType = (searchParams.get("type") ?? "FOR_YOU").toUpperCase() as RecommendationType;
    const mood = searchParams.get("mood");

    let cards: RecommendedCard[];
    if (rawType === "BECAUSE_YOU_LIKED") {
      const result = await getBecauseYouLiked(userId, limit);
      cards = result?.items ?? [];
    } else if (rawType === "OUTSIDE_USUAL_TASTE") {
      cards = await getOutsideUsualTaste(userId, limit);
    } else {
      cards = await getRecommendationsForUser(userId, {
        limit,
        kind: kind ?? TYPE_KIND_FILTER[rawType],
        recommendationType: rawType,
      });
    }

    if (mood) {
      cards = cards.filter((c) => c.moods?.includes(mood));
    }

    const reasonsById = new Map((await getStructuredReasons(userId, cards)).map((r) => [r.id, r.reasons]));
    const generatedAt = new Date().toISOString();

    const results = cards.map((card) => ({
      id: `${card.kind}:${card.id}`,
      content: card,
      score: card.score,
      recommendationType: card.recommendationType ?? rawType,
      reasons: reasonsById.get(card.id) ?? [],
      generatedAt,
    }));

    return ok(results);
  });
}
