import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { undoFeedback } from "@/lib/taste/feedback";
import { ok, unauthorized, notFound, handleApi } from "@/lib/api/response";

const bodySchema = z.object({ feedbackId: z.string().min(1) });

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { feedbackId } = bodySchema.parse(await request.json());
    const undone = await undoFeedback(userId, feedbackId);
    if (!undone) return notFound("That feedback was already undone or doesn't exist.");

    return ok({ undone: true });
  });
}
