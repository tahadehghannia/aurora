import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { discoverByMood } from "@/lib/ai/mood-discovery";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

const bodySchema = z.object({ prompt: z.string().trim().min(3).max(300) });

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const { prompt } = bodySchema.parse(await request.json());
    return ok(await discoverByMood(userId, prompt));
  });
}
