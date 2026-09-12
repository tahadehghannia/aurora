import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { generatePlaylist } from "@/lib/ai/playlist";
import { ok, unauthorized, apiError, handleApi } from "@/lib/api/response";

const bodySchema = z.object({ prompt: z.string().trim().min(3).max(300) });

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { prompt } = bodySchema.parse(await request.json());
    const playlist = await generatePlaylist(userId, prompt);

    if (playlist.items.length === 0) {
      return apiError("Couldn't find songs matching that — try describing a mood, genre or artist.", 422, "NO_MATCHES");
    }

    return ok(playlist);
  });
}
