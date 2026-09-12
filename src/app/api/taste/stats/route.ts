import { getCurrentUserId } from "@/lib/auth/session";
import { getTasteStats } from "@/lib/taste/stats";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

export async function GET() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    return ok(await getTasteStats(userId));
  });
}
