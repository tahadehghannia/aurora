import { getCurrentUserId } from "@/lib/auth/session";
import { getTasteEvolution } from "@/lib/taste/evolution";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

export async function GET() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    return ok(await getTasteEvolution(userId));
  });
}
