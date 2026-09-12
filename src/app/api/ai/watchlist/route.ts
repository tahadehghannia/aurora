import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { generateWatchlist } from "@/lib/ai/watchlist";
import { ok, unauthorized, apiError, handleApi } from "@/lib/api/response";

const bodySchema = z.object({ prompt: z.string().trim().min(3).max(300) });

/** Generates a preview watchlist from a natural-language prompt — not persisted until /save. */
export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { prompt } = bodySchema.parse(await request.json());
    const watchlist = await generateWatchlist(userId, prompt);

    if (watchlist.items.length === 0) {
      return apiError("Couldn't find anything matching that — try describing a mood or genre.", 422, "NO_MATCHES");
    }

    return ok(watchlist);
  });
}
