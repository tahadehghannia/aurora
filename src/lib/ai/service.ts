import "server-only";
import type { z } from "zod";
import { getAiProvider, isAiConfigured } from "@/lib/ai/provider";
import { AiProviderError, NO_USAGE, type AiUsage } from "@/lib/ai/provider/types";
import { recordAiCall } from "@/lib/ai/telemetry";

/**
 * The Aurora AI Service.
 *
 * Feature code never talks to a provider directly and never sees raw model
 * text. It asks for a value matching a Zod schema and gets back a discriminated
 * outcome that is *always* safe to branch on — this function does not throw.
 * Anything the model produces that doesn't validate is discarded, because
 * free-form model output is never trusted as application state (spec §32).
 */

export type AiFailureReason =
  | "unconfigured"
  | "auth"
  | "rate_limited"
  | "timeout"
  | "server_error"
  | "invalid_output"
  /** The caller went away mid-flight — a navigation, not a provider fault. */
  | "aborted";

export type AiOutcome<T> =
  | { ok: true; data: T; provider: string; model: string }
  | { ok: false; reason: AiFailureReason };

/** User-facing copy per failure mode. Never leaks provider names or status codes. */
export const AI_FAILURE_COPY: Record<AiFailureReason, string> = {
  unconfigured: "AI curation is off, so this list was built by Aurora's own ranking.",
  auth: "AI curation is unavailable right now, so Aurora ranked this list itself.",
  rate_limited: "AI curation hit its rate limit, so Aurora ranked this list itself.",
  timeout: "AI curation took too long, so Aurora ranked this list itself.",
  server_error: "AI curation is unavailable right now, so Aurora ranked this list itself.",
  invalid_output: "AI curation returned something unusable, so Aurora ranked this list itself.",
  aborted: "That request was cancelled before it finished.",
};

/** Attempts per call: one retry for transient faults, then give up. */
const MAX_ATTEMPTS = 2;

/**
 * Circuit breaker for rate limiting.
 *
 * A free-tier quota is shared across every AI feature, so once the provider
 * starts returning 429 the useful response is to stop asking for a while
 * rather than to keep paying two failed round-trips per render. Without this,
 * a burst of low-value calls keeps the circuit hot and starves the high-value
 * ones behind it.
 */
const COOLDOWN_MS = 20_000;
let rateLimitedUntil = 0;

export function isRateLimitCooldown(): boolean {
  return Date.now() < rateLimitedUntil;
}

export function resetRateLimitCooldown(): void {
  rateLimitedUntil = 0;
}

function classify(error: unknown): AiFailureReason {
  if (error instanceof AiProviderError) {
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status === 429) return "rate_limited";
    // A transport failure the provider marked non-retryable is a cancelled
    // request, not a slow one.
    if (error.status === null) return error.retryable ? "timeout" : "aborted";
    return "server_error";
  }
  return "server_error";
}

/**
 * Models wrap JSON in prose or code fences often enough that pulling the first
 * balanced object out is worth doing before giving up on a response.
 *
 * Brace counting is string- and escape-aware: a `}` inside a reason string must
 * not be mistaken for the end of the object. Exported for testing.
 */
export function extractJson(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? trimmed).trim();

  const start = body.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return null;
}

interface StructuredRequest<T> {
  /** Task name for observability, e.g. "identity". */
  task: string;
  /** Prompt version, stored alongside anything this call produces (§23). */
  promptVersion: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Ask the configured provider for a value matching `schema`.
 *
 * Retries once on transient failures (429/5xx/timeout) and once on output that
 * fails validation, then gives up. Auth failures are never retried — a bad key
 * will still be bad on the second attempt.
 */
export async function generateStructured<T>(request: StructuredRequest<T>): Promise<AiOutcome<T>> {
  const provider = getAiProvider();
  if (!provider) return { ok: false, reason: "unconfigured" };

  const { task, promptVersion, system, user, schema, maxTokens = 1200, timeoutMs = 12_000 } = request;

  // Still cooling down from a 429 — fail fast to the deterministic path rather
  // than spending two more round-trips discovering the quota is still gone.
  if (isRateLimitCooldown()) return { ok: false, reason: "rate_limited" };
  const startedAt = Date.now();
  let lastReason: AiFailureReason = "server_error";
  let usage: AiUsage = NO_USAGE;
  let attempts = 0;

  const finish = (ok: boolean, reason?: AiFailureReason) => {
    recordAiCall({
      task,
      provider: provider.name,
      model: provider.model,
      promptVersion,
      ok,
      ...(reason ? { reason } : {}),
      latencyMs: Date.now() - startedAt,
      usage,
      // `attempts` is the loop counter, which sits one past the last attempt
      // once the loop exits; report what actually ran.
      attempts: Math.min(attempts, MAX_ATTEMPTS),
    });
  };

  for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
    let completion: { text: string; usage: AiUsage };
    try {
      completion = await provider.complete({ system, user, maxTokens, json: true, timeoutMs });
      usage = completion.usage;
    } catch (error) {
      lastReason = classify(error);
      // A rejected credential won't fix itself on retry.
      if (lastReason === "auth") {
        finish(false, lastReason);
        return { ok: false, reason: lastReason };
      }
      // Neither will an exhausted quota, within the next few seconds.
      if (lastReason === "aborted") {
        finish(false, lastReason);
        return { ok: false, reason: lastReason };
      }
      if (lastReason === "rate_limited") {
        rateLimitedUntil = Date.now() + COOLDOWN_MS;
        finish(false, lastReason);
        return { ok: false, reason: lastReason };
      }
      continue;
    }

    const json = extractJson(completion.text);
    if (!json) {
      lastReason = "invalid_output";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      lastReason = "invalid_output";
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      finish(true);
      return { ok: true, data: result.data, provider: provider.name, model: provider.model };
    }
    lastReason = "invalid_output";
  }

  finish(false, lastReason);
  return { ok: false, reason: lastReason };
}

export { isAiConfigured };
