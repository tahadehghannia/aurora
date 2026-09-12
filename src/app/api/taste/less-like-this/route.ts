import { getCurrentUserId } from "@/lib/auth/session";
import { libraryItemSchema } from "@/lib/validation/content";
import { recordLessLikeThis } from "@/lib/taste/feedback";
import { created, unauthorized, handleApi } from "@/lib/api/response";

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { kind, contentId } = libraryItemSchema.parse(await request.json());
    const result = await recordLessLikeThis(userId, kind, contentId);

    return created(result);
  });
}
