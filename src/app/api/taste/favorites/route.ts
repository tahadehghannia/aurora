import { getCurrentUserId } from "@/lib/auth/session";
import { getFavoriteContent } from "@/lib/taste/favorites";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

export async function GET() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    return ok(await getFavoriteContent(userId));
  });
}
