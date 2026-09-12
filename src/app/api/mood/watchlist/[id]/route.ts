import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { deleteMoodWatchlist, getMoodWatchlist, renameMoodWatchlist } from "@/lib/mood/store";
import { ok, noContent, notFound, unauthorized, handleApi } from "@/lib/api/response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await context.params;
    const watchlist = await getMoodWatchlist(userId, id);
    // Ownership is enforced in the query, so a miss is indistinguishable from
    // "not yours" — which is what we want to return.
    if (!watchlist) return notFound("That watchlist doesn't exist.");
    return ok(watchlist);
  });
}

const patchSchema = z.object({ title: z.string().trim().min(1).max(80) });

/** Rename (§25). */
export async function PATCH(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await context.params;
    const { title } = patchSchema.parse(await request.json());
    const renamed = await renameMoodWatchlist(userId, id, title);
    if (!renamed) return notFound("That watchlist doesn't exist.");
    return ok({ id, title });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { id } = await context.params;
    const deleted = await deleteMoodWatchlist(userId, id);
    if (!deleted) return notFound("That watchlist doesn't exist.");
    return noContent();
  });
}
