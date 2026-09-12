import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { rateLimit } from "@/lib/api/rate-limit";
import { moodRequestSchema } from "@/lib/mood/intent";
import { pickReplacementItem } from "@/lib/mood/generate";
import { ok, apiError, unauthorized, handleApi } from "@/lib/api/response";

/**
 * Swaps one title in a preview that hasn't been saved yet (§26, §30).
 *
 * Separate from the saved-list route because there is no watchlist id to own
 * here — the client holds the preview. Costs one ranking pass and no AI call,
 * so replacing a single item never regenerates the whole list.
 */

const bodySchema = moodRequestSchema.extend({
  /** Everything currently on screen, so the replacement is genuinely new. */
  excludeIds: z.array(z.string().min(1)).max(60).default([]),
  /** Optional nudge: "something less romantic". */
  refinement: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const limit = rateLimit(`mood:replace:${userId}`, 30, 60_000);
    if (!limit.allowed) {
      return apiError(`Slow down a moment — try again in ${limit.retryAfterSec} seconds.`, 429, "RATE_LIMITED");
    }

    const { excludeIds, refinement, ...rest } = bodySchema.parse(await request.json());
    const moodRequest = moodRequestSchema.parse(
      refinement ? { ...rest, prompt: `${rest.prompt}, ${refinement}` } : rest
    );

    const replacement = await pickReplacementItem(userId, moodRequest, excludeIds);
    if (!replacement) {
      return apiError("Aurora couldn't find another title that fits. Try loosening the request.", 422, "NO_MATCHES");
    }
    return ok(replacement);
  });
}
