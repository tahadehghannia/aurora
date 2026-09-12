import { getCurrentUserId } from "@/lib/auth/session";
import { resetPersonalizationOverrides } from "@/lib/taste/feedback";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

export async function POST() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    await resetPersonalizationOverrides(userId);

    return ok({ reset: true });
  });
}
