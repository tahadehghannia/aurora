import { describe, it, expect } from "vitest";
import { buildDataVersion } from "@/lib/ai/cache";

/**
 * The fingerprint that decides when a cached artifact is stale (§22).
 *
 * It is what stops Aurora regenerating an identity on every profile view, and
 * equally what stops a stale identity outliving the taste that produced it —
 * so the bucketing behaviour is worth pinning down.
 */
describe("buildDataVersion", () => {
  const base = { ratings: 10, saved: 4, watched: 2, listened: 0 };

  it("is stable for the same inputs", () => {
    expect(buildDataVersion(base)).toBe(buildDataVersion({ ...base }));
  });

  it("ignores a single new rating — taste doesn't move between 10 and 11", () => {
    expect(buildDataVersion({ ...base, ratings: 11 })).toBe(buildDataVersion(base));
  });

  it("changes once a session's worth of activity accumulates", () => {
    expect(buildDataVersion({ ...base, ratings: 15 })).not.toBe(buildDataVersion(base));
  });

  it("responds to every signal type, not just ratings", () => {
    expect(buildDataVersion({ ...base, saved: 20 })).not.toBe(buildDataVersion(base));
    expect(buildDataVersion({ ...base, watched: 20 })).not.toBe(buildDataVersion(base));
    expect(buildDataVersion({ ...base, listened: 20 })).not.toBe(buildDataVersion(base));
  });

  it("distinguishes which signal moved, so the fingerprint can't collide", () => {
    expect(buildDataVersion({ ratings: 20, saved: 0, watched: 0, listened: 0 })).not.toBe(
      buildDataVersion({ ratings: 0, saved: 20, watched: 0, listened: 0 })
    );
  });
});
