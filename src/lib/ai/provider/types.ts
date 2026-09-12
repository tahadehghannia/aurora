/**
 * The narrow contract Aurora asks of any AI provider.
 *
 * Deliberately tiny: one call that takes a system instruction plus a user
 * message and returns text. Everything Aurora actually needs — intent
 * extraction, curation — is JSON-in/JSON-out on top of this, so swapping
 * providers never touches feature code.
 *
 * No provider SDK is imported anywhere in Aurora. Each implementation is a
 * plain `fetch` against the provider's HTTP API, which keeps the dependency
 * surface at zero and the abstraction honest.
 */
export interface AiCompletionRequest {
  /** Instructions that define the model's role and hard constraints. */
  system: string;
  /** The actual payload — for Aurora this is always compact structured evidence. */
  user: string;
  /** Hard ceiling on output size. Aurora's responses are small by design. */
  maxTokens: number;
  /** Ask the provider to emit JSON natively where it supports doing so. */
  json: boolean;
  /** Abort budget in ms — a slow AI call must never hold a page hostage. */
  timeoutMs: number;
}

/** Token accounting, where the provider reports it. Used for observability only. */
export interface AiUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface AiCompletion {
  text: string;
  usage: AiUsage;
}

export interface AiProvider {
  /** Provider identity, surfaced in diagnostics and never in user-facing copy. */
  readonly name: string;
  readonly model: string;
  complete(request: AiCompletionRequest): Promise<AiCompletion>;
}

export const NO_USAGE: AiUsage = { promptTokens: null, completionTokens: null, totalTokens: null };

/** Thrown for any provider-side failure; carries the HTTP status when there was one. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/** 429 and 5xx are worth a retry; 401/403 and malformed requests are not. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}
