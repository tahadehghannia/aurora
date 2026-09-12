import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { extractJson } from "@/lib/ai/service";

/**
 * The two places model output can hurt Aurora: parsing whatever text comes
 * back, and deciding which provider a credential belongs to.
 */

describe("extractJson", () => {
  it("reads a plain JSON object", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("unwraps a fenced code block", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("pulls the object out of surrounding prose", () => {
    expect(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.')).toBe('{"a":1}');
  });

  it("keeps nested objects intact", () => {
    const json = '{"items":[{"contentId":"x","nested":{"deep":true}}]}';
    expect(extractJson(`noise ${json} more noise`)).toBe(json);
  });

  it("is not fooled by braces inside strings", () => {
    const json = '{"reason":"a } brace in text","ok":true}';
    expect(extractJson(json)).toBe(json);
  });

  it("handles escaped quotes inside strings", () => {
    const json = '{"reason":"she said \\"hi\\" then left"}';
    expect(extractJson(json)).toBe(json);
  });

  it("returns null for output with no object at all", () => {
    expect(extractJson("I'm sorry, I can't help with that.")).toBeNull();
    expect(extractJson("")).toBeNull();
  });

  it("returns null for a truncated object rather than a broken fragment", () => {
    expect(extractJson('{"items":[{"contentId":"x"')).toBeNull();
  });
});

describe("provider resolution", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function resolve(key: string | undefined) {
    vi.stubEnv("AI_API_KEY", key ?? "");
    const mod = await import("@/lib/ai/provider");
    // The env is read on resolution, so clearing the memo is enough.
    mod.resetAiProviderCache();
    return mod.getAiProvider();
  }

  it("returns null when no key is configured", async () => {
    expect(await resolve(undefined)).toBeNull();
  });

  it("identifies a provider from its key prefix", async () => {
    expect((await resolve("sk-ant-api03-example"))?.name).toBe("anthropic");
    expect((await resolve("sk-proj-example"))?.name).toBe("openai");
    expect((await resolve("AIzaSyExample"))?.name).toBe("google");
    expect((await resolve("gsk_example"))?.name).toBe("groq");
  });

  it("refuses to guess a provider for an unrecognized key", async () => {
    // Sending a credential to a vendor it doesn't belong to is a real leak, so
    // an unidentifiable key disables AI rather than getting sprayed around.
    expect(await resolve("80f585550000000000000000000000e1")).toBeNull();
  });

  it("honours an explicit provider override for self-hosted gateways", async () => {
    vi.stubEnv("AI_PROVIDER", "mistral");
    vi.stubEnv("AI_MODEL", "mistral-large-latest");
    const provider = await resolve("some-opaque-gateway-key");
    expect(provider?.name).toBe("mistral");
    expect(provider?.model).toBe("mistral-large-latest");
  });
});
