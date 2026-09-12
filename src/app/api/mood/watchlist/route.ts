import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { rateLimit } from "@/lib/api/rate-limit";
import { moodRequestSchema } from "@/lib/mood/intent";
import { generateMoodWatchlist } from "@/lib/mood/generate";
import { applyFreeformRefinement, applyPreset, isRefinementPreset, normalizeRequest } from "@/lib/mood/refine";
import { ok, unauthorized, apiError, handleApi } from "@/lib/api/response";

/**
 * Generates a mood watchlist preview. Nothing is persisted until /save (§25).
 *
 * Generation fans out into a wide candidate query and up to two AI calls, so it
 * is rate limited per user (§43) — enough headroom for real use including
 * refinements, far short of what it takes to hammer a provider.
 */

const GENERATE_LIMIT = 12;
const GENERATE_WINDOW_MS = 60_000;

const bodySchema = moodRequestSchema.extend({
  /** A one-tap refinement of the previous result (§27). */
  preset: z.string().optional(),
  /** A typed refinement: "make it more atmospheric" (§28). */
  refinement: z.string().trim().max(200).optional(),
  /** Items already removed or rejected — never re-offered. */
  excludeIds: z.array(z.string().min(1)).max(60).default([]),
  /** Varies deterministic titling between regenerates. */
  seed: z.number().int().min(0).max(9999).default(0),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const limit = rateLimit(`mood:generate:${userId}`, GENERATE_LIMIT, GENERATE_WINDOW_MS);
    if (!limit.allowed) {
      return apiError(
        `That's a lot of watchlists at once. Try again in ${limit.retryAfterSec} seconds.`,
        429,
        "RATE_LIMITED"
      );
    }

    const body = bodySchema.parse(await request.json());
    const { preset, refinement, excludeIds, seed, ...rest } = body;

    let moodRequest = moodRequestSchema.parse(rest);
    if (preset && isRefinementPreset(preset)) moodRequest = applyPreset(moodRequest, preset);
    if (refinement) moodRequest = applyFreeformRefinement(moodRequest, refinement);

    const watchlist = await generateMoodWatchlist(userId, normalizeRequest(moodRequest), { seed, excludeIds });

    // Candidate retrieval came back empty — the constraints were too tight to
    // satisfy honestly, so say so rather than quietly dropping them (§41).
    if (watchlist.items.length === 0) {
      return apiError(
        "Nothing in the catalogue matches all of that. Try relaxing one part of the request.",
        422,
        "NO_MATCHES"
      );
    }

    return ok(watchlist);
  });
}
