import "dotenv/config";

/**
 * Server-side connectivity check for Aurora's AI credential.
 *
 * Aurora has no AI provider wired in yet, so this script answers the only
 * question that matters before one can be: does the configured key actually
 * authenticate anywhere, and if so, with whom?
 *
 * It never prints the key. Every line of output — including provider error
 * bodies, which sometimes echo the credential back — is passed through
 * `redact()` first. Run it with `npm run ai:verify`.
 */

const ENV_VAR = "AI_API_KEY";
const KEY = process.env[ENV_VAR]?.trim() ?? "";
/** Gateway overrides. The app honours these, so verification must too. */
const BASE_URL_OVERRIDE = process.env["AI_BASE_URL"]?.trim() ?? "";
const PROVIDER_OVERRIDE = process.env["AI_PROVIDER"]?.trim().toLowerCase() ?? "";

/**
 * Strip the credential out of anything on its way to stdout.
 *
 * Whole-key replacement isn't enough: several providers echo a *partially*
 * masked key back in their 401 body (OpenAI returns the leading 8 and trailing
 * 4 characters), which would otherwise put 12 real characters on screen. So the
 * head and tail fragments are scrubbed too.
 */
function redact(value: unknown): string {
  let text = String(value);
  if (!KEY) return text;
  for (const fragment of [KEY, KEY.slice(0, 8), KEY.slice(-4)]) {
    if (fragment.length >= 4) text = text.split(fragment).join("<REDACTED>");
  }
  return text;
}

interface Candidate {
  /** Stable id, matched against AI_PROVIDER. */
  id: string;
  name: string;
  /** A free, non-generative endpoint — listing models costs no tokens. */
  url: string;
  headers: Record<string, string>;
  /** Key prefixes that positively identify this provider. */
  prefixes: string[];
  docs: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    url: "https://api.anthropic.com/v1/models",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    prefixes: ["sk-ant-"],
    docs: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    url: "https://api.openai.com/v1/models",
    headers: { Authorization: `Bearer ${KEY}` },
    prefixes: ["sk-proj-", "sk-"],
    docs: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    name: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    // Header auth, not ?key= — a credential must never sit in a URL.
    headers: { "x-goog-api-key": KEY },
    prefixes: ["AIza"],
    docs: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "mistral",
    name: "Mistral",
    url: "https://api.mistral.ai/v1/models",
    headers: { Authorization: `Bearer ${KEY}` },
    prefixes: [],
    docs: "https://console.mistral.ai/api-keys",
  },
  {
    id: "groq",
    name: "Groq",
    url: "https://api.groq.com/openai/v1/models",
    headers: { Authorization: `Bearer ${KEY}` },
    prefixes: ["gsk_"],
    docs: "https://console.groq.com/keys",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://api.deepseek.com/models",
    headers: { Authorization: `Bearer ${KEY}` },
    prefixes: [],
    docs: "https://platform.deepseek.com/api_keys",
  },
];

interface ProbeResult {
  name: string;
  status: number | null;
  detail: string;
  models: string[];
}

async function probe(candidate: Candidate): Promise<ProbeResult> {
  try {
    const res = await fetch(candidate.url, {
      headers: candidate.headers,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();

    if (!res.ok) {
      let detail = text.replace(/\s+/g, " ").slice(0, 160);
      try {
        const parsed = JSON.parse(text);
        detail = parsed?.error?.message ?? parsed?.detail ?? parsed?.error?.type ?? detail;
      } catch {
        /* non-JSON error body — the truncated raw text is the best detail available */
      }
      return { name: candidate.name, status: res.status, detail: redact(detail), models: [] };
    }

    // Every candidate returns either {data:[{id}]} or {models:[{name}]}.
    const parsed = JSON.parse(text) as {
      data?: { id?: string; name?: string }[];
      models?: { id?: string; name?: string }[];
    };
    const models = (parsed.data ?? parsed.models ?? [])
      .map((m) => m.id ?? m.name)
      .filter((m): m is string => typeof m === "string");

    return { name: candidate.name, status: res.status, detail: "authenticated", models };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    return { name: candidate.name, status: null, detail: redact(`${name}: ${message}`), models: [] };
  }
}

async function main(): Promise<number> {
  if (!KEY) {
    console.log(`${ENV_VAR} is not set.\n`);
    console.log(`Add it to .env (never to .env.example, and never NEXT_PUBLIC_*):`);
    console.log(`  ${ENV_VAR}="<your provider key>"\n`);
    console.log("Supported providers and where to get a key:");
    for (const c of CANDIDATES) console.log(`  ${c.name.padEnd(14)} ${c.docs}`);
    return 1;
  }

  // Report shape, never content — enough to spot a truncated or pasted-wrong key.
  const shape = /^[0-9a-f]+$/.test(KEY) ? "lowercase hex" : "mixed";
  console.log(`${ENV_VAR}: present (${KEY.length} chars, ${shape}, key itself never printed)\n`);

  // A gateway key often carries an upstream vendor's prefix (an OpenAI-style
  // "sk-" is common), so prefix routing would send it to the wrong host and
  // report a false INVALID. An explicit base URL always wins.
  let targets: Candidate[];
  if (BASE_URL_OVERRIDE) {
    const named = PROVIDER_OVERRIDE ? CANDIDATES.find((c) => c.id === PROVIDER_OVERRIDE) : undefined;
    const base = BASE_URL_OVERRIDE.replace(/\/+$/, "");
    targets = [
      {
        id: named?.id ?? "custom",
        name: `${named?.name ?? "Custom"} @ ${new URL(base).host}`,
        url: `${base}/models`,
        headers: named?.id === "anthropic"
          ? { "x-api-key": KEY, "anthropic-version": "2023-06-01" }
          : named?.id === "google"
            ? { "x-goog-api-key": KEY }
            : { Authorization: `Bearer ${KEY}` },
        prefixes: [],
        docs: base,
      },
    ];
    console.log(`AI_BASE_URL is set — verifying against that endpoint only.\n`);
  } else {
    const detected = CANDIDATES.find((c) => c.prefixes.some((p) => KEY.startsWith(p)));
    targets = detected ? [detected] : CANDIDATES;

    if (detected) {
      console.log(`Key prefix identifies: ${detected.name}. Verifying...\n`);
    } else {
      console.log("Key prefix matches no known provider. Probing all candidates...\n");
    }
  }

  const results = await Promise.all(targets.map(probe));
  for (const r of results) {
    const status = r.status === null ? "NET " : String(r.status).padEnd(4);
    console.log(`  ${r.name.padEnd(14)} ${status} ${r.detail}`);
  }

  const ok = results.find((r) => r.status !== null && r.status >= 200 && r.status < 300);
  console.log("");

  if (ok) {
    console.log(`VALID — authenticated against ${ok.name}.`);
    console.log(`Models visible to this key: ${ok.models.length}`);
    for (const m of ok.models.slice(0, 12)) console.log(`  - ${m}`);
    if (ok.models.length > 12) console.log(`  ... and ${ok.models.length - 12} more`);
    return 0;
  }

  const rateLimited = results.find((r) => r.status === 429);
  if (rateLimited) {
    console.log(`AUTHENTICATED but RATE LIMITED at ${rateLimited.name} (HTTP 429).`);
    console.log("The credential is real; the account has no usable quota right now.");
    return 2;
  }

  console.log("INVALID — no provider accepted this credential.");
  console.log("The requests reached each provider and were rejected on authentication,");
  console.log("so this is a bad/wrong key rather than a network or endpoint problem.");
  if (!BASE_URL_OVERRIDE) {
    console.log("");
    console.log("If this key belongs to a gateway or proxy rather than the vendor itself,");
    console.log("set AI_BASE_URL (and AI_PROVIDER for the wire format) and run this again —");
    console.log("a gateway key is expected to fail against the upstream vendor's own API.");
  }
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(redact(error instanceof Error ? error.message : error));
    process.exit(1);
  }
);
