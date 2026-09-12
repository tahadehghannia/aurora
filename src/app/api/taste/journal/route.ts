import { getCurrentUserId } from "@/lib/auth/session";
import { getJournal, type JournalFilter } from "@/lib/taste/journal";
import { ok, unauthorized, apiError, handleApi } from "@/lib/api/response";

const VALID_FILTERS = new Set<JournalFilter>(["all", "movie", "tv_show", "music"]);

export async function GET(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get("filter") ?? "all") as JournalFilter;
    if (!VALID_FILTERS.has(filter)) {
      return apiError(`Unknown journal filter "${filter}".`, 400, "INVALID_FILTER");
    }

    return ok(await getJournal(userId, filter));
  });
}
