import "server-only";
import type { z } from "zod";
import { generateStructured } from "@/lib/ai/service";
import { isAiConfigured } from "@/lib/ai/provider";
import {
  buildDataVersion,
  dedupe,
  getTasteDataInputs,
  readArtifact,
  writeArtifact,
  type AiArtifactKind,
} from "@/lib/ai/cache";
import type { PromptSpec } from "@/lib/ai/prompts";

/**
 * The one path every cached, per-user AI artifact takes (§22, §25, §28).
 *
 * Read cache -> deduplicate concurrent work -> generate -> validate -> store.
 * Any failure anywhere returns null, and callers treat null as "use the
 * deterministic result" — which is why an AI outage degrades Aurora's wording
 * and never its function.
 */

export interface EnhancementResult<T> {
  data: T;
  /** True when served from cache — surfaced so the UI can offer a regenerate. */
  cached: boolean;
  generatedAt: Date;
  modelVersion: string;
}

interface EnhanceOptions<T> {
  userId: string;
  kind: AiArtifactKind;
  prompt: PromptSpec;
  schema: z.ZodType<T>;
  /**
   * Builds the compact evidence message. Called only on a cache miss, so an
   * expensive evidence query costs nothing on the common path.
   */
  buildUser: () => Promise<string> | string;
  maxTokens?: number;
  /** Skips the cache and regenerates — the "Regenerate" action (§29). */
  force?: boolean;
}

export async function enhance<T>(options: EnhanceOptions<T>): Promise<EnhancementResult<T> | null> {
  const { userId, kind, prompt, schema, buildUser, maxTokens = 700, force = false } = options;

  if (!isAiConfigured()) return null;

  const inputs = await getTasteDataInputs(userId);
  const dataVersion = buildDataVersion(inputs);

  if (!force) {
    const cached = await readArtifact(userId, kind, schema, {
      dataVersion,
      promptVersion: prompt.version,
    });
    if (cached) {
      return {
        data: cached.payload,
        cached: true,
        generatedAt: cached.generatedAt,
        modelVersion: cached.modelVersion,
      };
    }
  }

  // Keyed on the data fingerprint too, so a regenerate after new activity is
  // not collapsed into an in-flight call for the previous state.
  return dedupe(`${kind}:${userId}:${dataVersion}:${force}`, async () => {
    const user = await buildUser();

    const outcome = await generateStructured({
      task: prompt.task,
      promptVersion: prompt.version,
      system: prompt.system,
      user,
      schema,
      maxTokens,
    });

    if (!outcome.ok) return null;

    await writeArtifact(userId, kind, outcome.data, {
      modelVersion: outcome.model,
      promptVersion: prompt.version,
      dataVersion,
    });

    return { data: outcome.data, cached: false, generatedAt: new Date(), modelVersion: outcome.model };
  });
}

/**
 * Formats a labelled evidence block for a prompt.
 *
 * Every line is a fact Aurora computed from the database. Keeping the shape
 * uniform makes it obvious in review what a model is being told — and equally
 * obvious that it is never handed raw rows or personal profile fields (§20, §31).
 */
export function evidenceBlock(sections: { label: string; lines: string[] }[]): string {
  return sections
    .filter((section) => section.lines.length > 0)
    .map((section) => `${section.label}:\n${section.lines.map((line) => `- ${line}`).join("\n")}`)
    .join("\n\n");
}
