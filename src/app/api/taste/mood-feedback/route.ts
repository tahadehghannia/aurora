import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { applyMoodFeedback } from "@/lib/taste/feedback";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

const bodySchema = z.object({
  mood: z.string().min(1),
  action: z.enum(["more", "less"]),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { mood, action } = bodySchema.parse(await request.json());
    await applyMoodFeedback(userId, mood, action);

    return ok({ mood, action });
  });
}
