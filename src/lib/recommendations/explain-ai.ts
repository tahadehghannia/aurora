import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/service";
import { isAiConfigured } from "@/lib/ai/provider";
import { buildDataVersion, dedupe, getTasteDataInputs } from "@/lib/ai/cache";
import { prisma } from "@/lib/db/prisma";
import { CONTENT_TYPE_MAP } from "@/types/content";
import { evidenceBlock } from "@/lib/ai/enhance";
import { ONE_PICK_PROMPT, WHY_THIS_PROMPT } from "@/lib/ai/prompts";
import type { RecommendationReason } from "@/lib/recommendations/reasons";
import type { ContentCard } from "@/types/content";

/**
 * AI explanation for recommendations (§10, §11) and the single nightly pick
 * (§14).
 *
 * The direction of the data flow is the whole point. Aurora's ranking decides
 * what is recommended and why; the model is handed those reasons and asked to
 * say them in one sentence. It is never asked what the user likes, and it can
 * never introduce a title — for One Perfect Pick it may only return an id that
 * was in the candidate list it was given.
 */

const whyThisSchema = z.object({
  explanation: z.string().trim().min(8).max(200),
});

/** Overclaiming about someone's taste is the failure mode worth blocking outright. */
const OVERCLAIM = /\b(you love|you adore|obsessed|clearly a fan|you must|favourite ever|favorite ever)\b/i;

export function isGroundedExplanation(text: string): boolean {
  return !OVERCLAIM.test(text);
}

function reasonLines(reasons: RecommendationReason[]): string[] {
  return reasons.slice(0, 5).map((r) => `${r.text} [signal: ${r.reasonType}, confidence: ${r.confidence}]`);
}

/**
 * One grounded sentence for a recommendation.
 *
 * Returns null on any failure, and the caller keeps Aurora's own reason text —
 * which is already a complete, correct explanation, just a more mechanical one.
 */
export async function explainRecommendation(
  card: ContentCard,
  reasons: RecommendationReason[],
  userId: string
): Promise<string | null> {
  if (!isAiConfigured() || reasons.length === 0) return null;

  const contentType = CONTENT_TYPE_MAP[card.kind];
  const dataVersion = buildDataVersion(await getTasteDataInputs(userId));

  // A detail page is visited far more often than a user's taste changes, so a
  // cached sentence is reused until the taste behind it actually moves (§26).
  const cached = await prisma.aiExplanation.findUnique({
    where: { userId_contentType_contentId: { userId, contentType: contentType as never, contentId: card.id } },
  });
  if (cached && cached.dataVersion === dataVersion && cached.promptVersion === WHY_THIS_PROMPT.version) {
    return cached.text;
  }

  const user = [
    `Candidate: ${card.title} (${card.year ?? "year unknown"})`,
    `Genres: ${(card.genres ?? []).slice(0, 3).join(", ") || "unknown"}`,
    `Moods: ${(card.moods ?? []).slice(0, 3).join(", ") || "unknown"}`,
    "",
    evidenceBlock([{ label: "Signals that caused Aurora to rank this", lines: reasonLines(reasons) }]),
  ].join("\n");

  // Two cards on one page can share a candidate; one call is enough.
  const outcome = await dedupe(`why:${userId}:${card.kind}:${card.id}:${dataVersion}`, () =>
    generateStructured({
      task: "whyThis",
      promptVersion: WHY_THIS_PROMPT.version,
      system: WHY_THIS_PROMPT.system,
      user,
      schema: whyThisSchema,
      maxTokens: 900,
      timeoutMs: 8_000,
    })
  );

  if (!outcome.ok) return null;
  if (!isGroundedExplanation(outcome.data.explanation)) return null;

  const record = {
    text: outcome.data.explanation,
    modelVersion: outcome.model,
    promptVersion: WHY_THIS_PROMPT.version,
    dataVersion,
    generatedAt: new Date(),
  };
  await prisma.aiExplanation.upsert({
    where: { userId_contentType_contentId: { userId, contentType: contentType as never, contentId: card.id } },
    create: { userId, contentType: contentType as never, contentId: card.id, ...record },
    update: record,
  });

  return outcome.data.explanation;
}

// --- One Perfect Pick -------------------------------------------------------

const onePickSchema = z.object({
  contentId: z.string().min(1),
  reason: z.string().trim().min(8).max(300),
});

export interface PickCandidate {
  card: ContentCard;
  reasons: RecommendationReason[];
}

export interface AiPick {
  contentId: string;
  reason: string;
}

/**
 * Lets the model choose one title from Aurora's ranked shortlist and say why.
 *
 * An id that wasn't in the shortlist is discarded outright rather than
 * resolved or corrected — a model reaching outside the candidate set is exactly
 * the invention this architecture exists to prevent.
 */
export async function pickOneWithAi(
  candidates: PickCandidate[],
  context: { mood?: string | null; runtimeMaxMin?: number | null } = {}
): Promise<AiPick | null> {
  if (!isAiConfigured() || candidates.length === 0) return null;

  const allowed = new Set(candidates.map((c) => c.card.id));

  const lines = candidates.slice(0, 12).map((c) => {
    const evidence = c.reasons.slice(0, 2).map((r) => r.text).join(" ");
    return `id=${c.card.id} title=${c.card.title} year=${c.card.year ?? "?"} genres=${(c.card.genres ?? []).slice(0, 2).join("/")} evidence="${evidence}"`;
  });

  const user = [
    context.mood ? `Current mood signal: ${context.mood}` : "No specific mood stated.",
    context.runtimeMaxMin ? `They have about ${context.runtimeMaxMin} minutes.` : "No time constraint stated.",
    "",
    "Candidates:",
    ...lines,
  ].join("\n");

  const outcome = await generateStructured({
    task: "onePerfectPick",
    promptVersion: ONE_PICK_PROMPT.version,
    system: ONE_PICK_PROMPT.system,
    user,
    schema: onePickSchema,
    maxTokens: 800,
    timeoutMs: 10_000,
  });

  if (!outcome.ok) return null;
  if (!allowed.has(outcome.data.contentId)) return null;
  if (!isGroundedExplanation(outcome.data.reason)) return null;

  return outcome.data;
}
