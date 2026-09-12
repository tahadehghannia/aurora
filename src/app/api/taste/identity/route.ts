import { getCurrentUserId } from "@/lib/auth/session";
import { getEntertainmentIdentity } from "@/lib/taste/identity";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

export async function GET() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    return ok(await getEntertainmentIdentity(userId));
  });
}
