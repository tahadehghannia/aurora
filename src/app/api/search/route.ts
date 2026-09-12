import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { searchContent } from "@/lib/content/queries";
import { ok, apiError, handleApi } from "@/lib/api/response";

const MAX_QUERY_LENGTH = 200;

export async function GET(request: Request) {
  return handleApi(async () => {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
    if ((searchParams.get("q")?.length ?? 0) > MAX_QUERY_LENGTH) {
      return apiError(`Search queries are limited to ${MAX_QUERY_LENGTH} characters.`, 400, "QUERY_TOO_LONG");
    }

    const results = await searchContent(q);

    const userId = await getCurrentUserId();
    if (userId && q.trim().length > 1) {
      await prisma.searchHistory.create({ data: { userId, query: q.trim() } });
    }

    return ok(results);
  });
}
