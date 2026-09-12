import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { libraryItemSchema } from "@/lib/validation/content";
import { CONTENT_TYPE_MAP } from "@/types/content";
import { created, unauthorized, apiError, handleApi } from "@/lib/api/response";

const WATCH_KINDS = new Set(["movie", "tv_show", "episode"]);
const LISTEN_KINDS = new Set(["album", "song"]);

/** Logs a watch/listen event — powers "Continue Watching" and feeds the recommendation signal. */
export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { kind, contentId } = libraryItemSchema.parse(await request.json());

    if (!WATCH_KINDS.has(kind) && !LISTEN_KINDS.has(kind)) {
      return apiError(`"${kind}" has no watch/listen activity to mark.`, 400, "UNSUPPORTED_KIND");
    }

    const contentType = CONTENT_TYPE_MAP[kind] as never;

    if (WATCH_KINDS.has(kind)) {
      await prisma.watchHistory.create({
        data: { userId, contentType, contentId, progressPct: 100 },
      });
    } else {
      await prisma.listeningHistory.create({
        data: { userId, contentType, contentId },
      });
    }

    const interaction = await prisma.userContentInteraction.create({
      data: { userId, contentType, contentId, interactionType: "PLAY", weight: 1 },
    });

    return created(interaction);
  });
}
