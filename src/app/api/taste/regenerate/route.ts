import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { rateLimit } from "@/lib/api/rate-limit";
import { invalidateArtifact } from "@/lib/ai/cache";
import { ok, apiError, unauthorized, handleApi } from "@/lib/api/response";

/**
 * Drops a cached AI artifact so the next read regenerates it (§29).
 *
 * Deliberately just an invalidation: regenerating inline would make the user
 * wait on a model call inside a POST, when the page they are about to refresh
 * will generate it anyway. Rate limited because each one costs a real call.
 */

const bodySchema = z.object({
  kind: z.enum(["IDENTITY", "DNA", "MOOD_PROFILE", "TASTE_EVOLUTION"]),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const limit = rateLimit(`taste:regenerate:${userId}`, 6, 60_000);
    if (!limit.allowed) {
      return apiError(
        `Give Aurora a moment to think — try again in ${limit.retryAfterSec} seconds.`,
        429,
        "RATE_LIMITED"
      );
    }

    const { kind } = bodySchema.parse(await request.json());
    await invalidateArtifact(userId, kind);

    return ok({ kind, regenerating: true });
  });
}
