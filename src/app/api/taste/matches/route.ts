import { getCurrentUserId } from "@/lib/auth/session";
import { getTasteMatches } from "@/lib/taste/taste-match";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

export async function GET() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    return ok(await getTasteMatches(userId));
  });
}
