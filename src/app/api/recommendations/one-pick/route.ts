import { getCurrentUserId } from "@/lib/auth/session";
import { getOnePerfectPick } from "@/lib/recommendations/one-pick";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

const MAX_EXCLUDE = 20;

export async function GET(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const exclude = (searchParams.get("exclude") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_EXCLUDE);

    return ok(await getOnePerfectPick(userId, exclude));
  });
}
