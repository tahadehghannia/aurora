import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { setGenreMuted, setCreatorMuted, setMoodMuted } from "@/lib/taste/feedback";
import { ok, unauthorized, apiError, handleApi } from "@/lib/api/response";

const bodySchema = z.object({
  type: z.enum(["genre", "creator", "mood"]),
  value: z.string().min(1),
  muted: z.boolean(),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { type, value, muted } = bodySchema.parse(await request.json());

    if (type === "genre") {
      await setGenreMuted(userId, value, muted);
    } else if (type === "mood") {
      await setMoodMuted(userId, value, muted);
    } else {
      if (!value.startsWith("director:") && !value.startsWith("artist:")) {
        return apiError('Creator value must be tagged "director:<name>" or "artist:<id>".', 400, "INVALID_CREATOR_KEY");
      }
      await setCreatorMuted(userId, value, muted);
    }

    return ok({ type, value, muted });
  });
}
