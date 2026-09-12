import { getCurrentUserId } from "@/lib/auth/session";
import { getFriendsActivity } from "@/lib/taste/friends-activity";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

export async function GET() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    return ok(await getFriendsActivity(userId));
  });
}
