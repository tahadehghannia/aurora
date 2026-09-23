import "server-only";
import {
  AiProviderError,
  isRetryableStatus,
  NO_USAGE,
  type AiCompletion,
  type AiCompletionRequest,
  type AiProvider,
  type AiUsage,
} from "@/lib/ai/provider/types";

/**
 * Resolves the configured AI provider from the environment, or null when none
 * is configured.
 *
 * Aurora treats "no provider" as a first-class, supported state rather than an
 * error: every AI-assisted feature has a deterministic path that runs on the
 * same real data (see src/lib/mood). A missing or rejected key degrades the
 * copy, never the product.
 *
 * The credential is read here and nowhere else. It is never logged, never
 * returned, and never reaches a client bundle — this module is server-only.
 */

interface AiEnv {
  key: string;
  /** Optional overrides for self-hosted gateways or pinning a specific model. */
  providerOverride: string;
  modelOverride: string;
  baseUrlOverride: string;
}

/**
 * Read on resolution rather than at module load, so the memoization below can
 * genuinely be reset — a cache seam that can't observe a changed environment is
 * not a seam at all.
 */
function readEnv(): AiEnv {
  return {
    key: process.env["AI_API_KEY"]?.trim() ?? "",
    providerOverride: process.env["AI_PROVIDER"]?.trim().toLowerCase() ?? "",
    modelOverride: process.env["AI_MODEL"]?.trim() ?? "",
    baseUrlOverride: process.env["AI_BASE_URL"]?.trim() ?? "",
  };
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Timeouts and network faults are transient by nature. An AbortError with
    // no timeout is a different thing entirely — the caller went away, usually
    // because the user navigated mid-render — and calling that a timeout makes
    // the logs lie about what the provider did.
    const name = error instanceof Error ? error.name : "Error";
    throw new AiProviderError(`transport failure (${name})`, null, name !== "AbortError");
  }

  if (!res.ok) {
    // The body may echo the credential back; it is never surfaced or logged.
    throw new AiProviderError(`provider returned HTTP ${res.status}`, res.status, isRetryableStatus(res.status));
  }
  return res.json();
}

/** Anthropic Messages API. */
function anthropic(model: string, env: AiEnv): AiProvider {
  return {
    name: "anthropic",
    model,
    async complete(req: AiCompletionRequest): Promise<AiCompletion> {
      const json = (await postJson(
        `${env.baseUrlOverride || "https://api.anthropic.com"}/v1/messages`,
        { "x-api-key": env.key, "anthropic-version": "2023-06-01" },
        {
          model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
        },
        req.timeoutMs
      )) as {
        content?: { type?: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const text = (json.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");

      const promptTokens = json.usage?.input_tokens ?? null;
      const completionTokens = json.usage?.output_tokens ?? null;
      return {
        text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens !== null && completionTokens !== null ? promptTokens + completionTokens : null,
        },
      };
    },
  };
}

/**
 * OpenAI's Chat Completions shape, which OpenAI, Groq, DeepSeek, Mistral,
 * Together and most self-hosted gateways all speak. One implementation covers
 * all of them; only the base URL and default model differ.
 */
function openAiCompatible(name: string, baseUrl: string, model: string, env: AiEnv): AiProvider {
  return {
    name,
    model,
    async complete(req: AiCompletionRequest): Promise<AiCompletion> {
      const json = (await postJson(
        `${env.baseUrlOverride || baseUrl}/chat/completions`,
        { authorization: `Bearer ${env.key}` },
        {
          model,
          max_tokens: req.maxTokens,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
        },
        req.timeoutMs
      )) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      return {
        text: json.choices?.[0]?.message?.content ?? "",
        usage: {
          promptTokens: json.usage?.prompt_tokens ?? null,
          completionTokens: json.usage?.completion_tokens ?? null,
          totalTokens: json.usage?.total_tokens ?? null,
        },
      };
    },
  };
}

/** Google Gemini generateContent. */
function gemini(model: string, env: AiEnv): AiProvider {
  return {
    name: "google",
    model,
    async complete(req: AiCompletionRequest): Promise<AiCompletion> {
      const json = (await postJson(
        // Header auth, never ?key= — a credential must not sit in a URL.
        `${env.baseUrlOverride || "https://generativelanguage.googleapis.com"}/v1beta/models/${model}:generateContent`,
        { "x-goog-api-key": env.key },
        {
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: {
            maxOutputTokens: req.maxTokens,
            ...(req.json ? { responseMimeType: "application/json" } : {}),
          },
        },
        req.timeoutMs
      )) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      };

      return {
        text: (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""),
        usage: {
          promptTokens: json.usageMetadata?.promptTokenCount ?? null,
          completionTokens: json.usageMetadata?.candidatesTokenCount ?? null,
          totalTokens: json.usageMetadata?.totalTokenCount ?? null,
        },
      };
    },
  };
}

interface Registration {
  id: string;
  /** Key prefixes that positively identify this provider. */
  prefixes: string[];
  defaultModel: string;
  build: (model: string, env: AiEnv) => AiProvider;
}

/**
 * Default models are chosen for this workload specifically: Aurora's calls are
 * small, structured, and on a page-load path, so a fast mid-tier model beats a
 * frontier one. Override with AI_MODEL when that trade-off differs.
 *
 * These are model *ids*, which vendors retire on their own schedule — Google
 * withdrew gemini-2.0-flash in March 2026. A stale default here surfaces as a
 * 404 from the provider, so check the id when a previously working setup starts
 * failing after an upgrade.
 */
const REGISTRY: Registration[] = [
  {
    id: "anthropic",
    prefixes: ["sk-ant-"],
    defaultModel: "claude-sonnet-5",
    build: anthropic,
  },
  {
    id: "openai",
    prefixes: ["sk-proj-", "sk-"],
    defaultModel: "gpt-4o-mini",
    build: (m, env) => openAiCompatible("openai", "https://api.openai.com/v1", m, env),
  },
  {
    id: "google",
    prefixes: ["AIza"],
    defaultModel: "gemini-2.5-flash",
    build: gemini,
  },
  {
    id: "groq",
    prefixes: ["gsk_"],
    defaultModel: "openai/gpt-oss-20b",
    build: (m, env) => openAiCompatible("groq", "https://api.groq.com/openai/v1", m, env),
  },
  {
    id: "mistral",
    prefixes: [],
    defaultModel: "mistral-small-latest",
    build: (m, env) => openAiCompatible("mistral", "https://api.mistral.ai/v1", m, env),
  },
  {
    id: "deepseek",
    prefixes: [],
    defaultModel: "deepseek-chat",
    build: (m, env) => openAiCompatible("deepseek", "https://api.deepseek.com/v1", m, env),
  },
];

let resolved: AiProvider | null | undefined;

/**
 * The configured provider, or null when AI is unavailable.
 *
 * Resolution is by explicit AI_PROVIDER first, then by key prefix. A key whose
 * shape matches no known provider returns null rather than guessing — sending a
 * credential to the wrong vendor is a real leak, not a harmless probe.
 */
export function getAiProvider(): AiProvider | null {
  if (resolved !== undefined) return resolved;

  const env = readEnv();
  if (!env.key) {
    resolved = null;
    return resolved;
  }

  const registration = env.providerOverride
    ? REGISTRY.find((r) => r.id === env.providerOverride)
    : REGISTRY.find((r) => r.prefixes.some((p) => env.key.startsWith(p)));

  resolved = registration ? registration.build(env.modelOverride || registration.defaultModel, env) : null;
  return resolved;
}

/** Whether an AI provider is configured at all — drives honest UI labelling. */
export function isAiConfigured(): boolean {
  return getAiProvider() !== null;
}

export type { AiUsage };
export { NO_USAGE };

/** Test seam: clears the memoized provider so env changes take effect. */
export function resetAiProviderCache(): void {
  resolved = undefined;
}
