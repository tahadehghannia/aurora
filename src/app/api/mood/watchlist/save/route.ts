import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { contentKindSchema } from "@/lib/validation/content";
import { moodIntentSchema } from "@/lib/mood/intent";
import { MOOD_REASON_TYPES } from "@/lib/mood/rank";
import { saveMoodWatchlist } from "@/lib/mood/store";
import { created, unauthorized, handleApi } from "@/lib/api/response";
import type { GeneratedMoodWatchlist } from "@/lib/mood/generate";

/**
 * Persists a generated preview (§25).
 *
 * The client sends back the list it was shown, but every field is re-validated
 * here — reason types against the known vocabulary, intent against its schema —
 * because a preview round-trips through the browser and is not trustworthy on
 * return.
 */

const reasonTypeSchema = z.enum(MOOD_REASON_TYPES as [string, ...string[]]);

const bodySchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  whyThisList: z.string().trim().max(400).default(""),
  prompt: z.string().trim().min(1).max(400),
  intent: moodIntentSchema,
  exploration: z.enum(["close", "balanced", "surprise"]).default("balanced"),
  personalization: z.enum(["strong", "aligned", "exploratory", "general"]).default("general"),
  aiCurated: z.boolean().default(false),
  modelVersion: z.string().max(80).nullable().default(null),
  items: z
    .array(
      z.object({
        kind: contentKindSchema,
        contentId: z.string().min(1),
        reason: z.string().trim().max(200),
        reasonType: reasonTypeSchema,
      })
    )
    .min(1)
    .max(20),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const body = bodySchema.parse(await request.json());

    // saveMoodWatchlist takes the generated shape; rebuild it from the
    // validated payload rather than trusting what arrived.
    const generated = {
      title: body.title,
      description: body.description,
      whyThisList: body.whyThisList,
      prompt: body.prompt,
      intent: body.intent,
      exploration: body.exploration,
      personalization: body.personalization,
      ai: { curated: body.aiCurated, interpreted: false, configured: false, note: null },
      insufficientData: false,
      poolSize: 0,
      items: body.items.map((item) => ({
        card: { id: item.contentId, kind: item.kind } as GeneratedMoodWatchlist["items"][number]["card"],
        reason: item.reason,
        reasonType: item.reasonType as GeneratedMoodWatchlist["items"][number]["reasonType"],
        runtimeMin: null,
        year: 0,
      })),
    } satisfies GeneratedMoodWatchlist;

    const id = await saveMoodWatchlist(userId, generated, body.modelVersion);
    return created({ id });
  });
}
