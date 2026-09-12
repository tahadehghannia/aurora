import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { rateLimit } from "@/lib/api/rate-limit";
import { moodRequestSchema } from "@/lib/mood/intent";
import { pickReplacementItem } from "@/lib/mood/generate";
import { getMoodWatchlist, removeMoodWatchlistItem, replaceMoodWatchlistItem } from "@/lib/mood/store";
import { ok, noContent, notFound, apiError, unauthorized, handleApi } from "@/lib/api/response";

/**
 * Item-level editing on a saved watchlist (§26, §30).
 *
 * Replacement re-ranks and takes the single best remaining candidate rather
 * than regenerating the list, so the items the user kept stay exactly as they
 * were — and no AI call is needed to swap one title.
 */

const removeSchema = z.object({ contentId: z.string().min(1) });

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await context.params;
    const { contentId } = removeSchema.parse(await request.json());

    const removed = await removeMoodWatchlistItem(userId, id, contentId);
    if (!removed) return notFound("That item isn't in this watchlist.");
    return noContent();
  });
}

const replaceSchema = z.object({
  contentId: z.string().min(1),
  /** Optional nudge for the replacement, e.g. "something less romantic" (§26). */
  refinement: z.string().trim().max(200).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const limit = rateLimit(`mood:replace:${userId}`, 30, 60_000);
    if (!limit.allowed) {
      return apiError(`Slow down a moment — try again in ${limit.retryAfterSec} seconds.`, 429, "RATE_LIMITED");
    }

    const { id } = await context.params;
    const { contentId, refinement } = replaceSchema.parse(await request.json());

    const watchlist = await getMoodWatchlist(userId, id);
    if (!watchlist) return notFound("That watchlist doesn't exist.");
    if (!watchlist.items.some((item) => item.card.id === contentId)) {
      return notFound("That item isn't in this watchlist.");
    }

    // size is irrelevant to a single-item pick, so it keeps the schema default.
    // The stored intent's audience and runtime constraints are carried forward
    // explicitly, so the replacement honours the same rules as the original.
    const moodRequest = moodRequestSchema.parse({
      prompt: refinement ? `${watchlist.prompt}, ${refinement}` : watchlist.prompt,
      exploration: watchlist.exploration,
      audience: watchlist.intent.audience,
      runtimeMaxMin: watchlist.intent.runtimeMaxMin,
      contentType: watchlist.intent.contentTypes[0] ?? "any",
    });

    // Everything currently in the list is off the table, including the item
    // being swapped out.
    const replacement = await pickReplacementItem(
      userId,
      moodRequest,
      watchlist.items.map((item) => item.card.id)
    );
    if (!replacement) {
      return apiError("Aurora couldn't find another title that fits. Try loosening the request.", 422, "NO_MATCHES");
    }

    const swapped = await replaceMoodWatchlistItem(userId, id, contentId, {
      kind: replacement.card.kind,
      contentId: replacement.card.id,
      reason: replacement.reason,
      reasonType: replacement.reasonType,
    });
    if (!swapped) return notFound("That item isn't in this watchlist.");

    return ok(replacement);
  });
}
