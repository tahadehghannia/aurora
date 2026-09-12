import "server-only";
import type { AiUsage } from "@/lib/ai/provider/types";

/**
 * Server-side observability for AI calls (§36).
 *
 * Records what an operator needs to diagnose cost, latency and reliability —
 * and nothing else. The credential, the user's prompt text, the taste evidence
 * and the generated copy are all deliberately absent: a log line should never
 * become a second copy of user data, and a leaked log should never leak a key.
 */

export interface AiCallRecord {
  /** Which task ran, e.g. "identity" or "mood.curate". */
  task: string;
  provider: string;
  model: string;
  promptVersion: string;
  ok: boolean;
  /** Populated on failure only. */
  reason?: string;
  latencyMs: number;
  usage: AiUsage;
  /** How many attempts the call took, including the successful one. */
  attempts: number;
}

const recent: AiCallRecord[] = [];
const MAX_RECENT = 100;

/**
 * Logs one AI call. Uses console on purpose — Aurora has no logging backend
 * yet, and a structured single line is what a platform log drain will pick up.
 */
export function recordAiCall(record: AiCallRecord): void {
  recent.push(record);
  if (recent.length > MAX_RECENT) recent.shift();

  const parts = [
    `ai.${record.task}`,
    record.ok ? "ok" : `failed=${record.reason ?? "unknown"}`,
    `provider=${record.provider}`,
    `model=${record.model}`,
    `prompt=v${record.promptVersion}`,
    `latency=${record.latencyMs}ms`,
    `attempts=${record.attempts}`,
  ];
  if (record.usage.totalTokens !== null) parts.push(`tokens=${record.usage.totalTokens}`);

  if (record.ok) console.info(parts.join(" "));
  else console.warn(parts.join(" "));
}

/** Recent calls, newest last — for a future admin view or a debugging session. */
export function recentAiCalls(): readonly AiCallRecord[] {
  return recent;
}

export function resetAiTelemetry(): void {
  recent.length = 0;
}
