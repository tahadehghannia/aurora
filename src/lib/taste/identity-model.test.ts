import { describe, it, expect } from "vitest";
import { matchIdentity, matchConfidence, ARCHETYPES } from "@/lib/taste/identity-model";
import type { TasteSpectrum, SpectrumKey } from "@/lib/taste/identity-types";

function spectrum(key: SpectrumKey, position: number): TasteSpectrum {
  return { key, leftLabel: "L", rightLabel: "R", position, sampleSize: 20, evidence: "evidence" };
}

describe("matchIdentity", () => {
  it("returns null with no measured spectrums — an identity is never invented", () => {
    expect(matchIdentity([])).toBeNull();
  });

  it("matches a dark, slow, focused library to the Atmospheric Thinker", () => {
    const match = matchIdentity([spectrum("tone", 78), spectrum("pace", 82), spectrum("breadth", 42)]);
    expect(match?.archetype.key).toBe("atmospheric-thinker");
  });

  it("matches a very wide-ranging library to the Genre Wanderer", () => {
    const match = matchIdentity([spectrum("breadth", 88), spectrum("reach", 58)]);
    expect(match?.archetype.key).toBe("genre-wanderer");
  });

  it("matches a mainstream library to In The Current, not a flattering alternative", () => {
    // Discriminative power matters more than flattery: a mainstream library
    // should get the mainstream result.
    const match = matchIdentity([spectrum("reach", 10), spectrum("breadth", 50)]);
    expect(match?.archetype.key).toBe("popular-current");
  });

  it("only scores archetypes on axes the user actually has evidence for", () => {
    // Only `breadth` is measured, so an archetype that ignores breadth entirely
    // must not win by default on unmeasured axes.
    const match = matchIdentity([spectrum("breadth", 85)]);
    expect(match).not.toBeNull();
    expect(match!.matchedOn).toEqual(["breadth"]);
  });

  it("never reports matching on an axis that wasn't supplied", () => {
    const match = matchIdentity([spectrum("tone", 70)]);
    expect(match!.matchedOn.every((axis) => axis === "tone")).toBe(true);
  });

  it("produces a different identity for a different library — results are discriminative", () => {
    const dark = matchIdentity([spectrum("tone", 85), spectrum("pace", 85), spectrum("breadth", 30)]);
    const light = matchIdentity([spectrum("tone", 20), spectrum("pace", 15), spectrum("breadth", 30)]);
    expect(dark?.archetype.key).not.toBe(light?.archetype.key);
  });
});

describe("matchConfidence", () => {
  it("hedges when a single axis can't decisively separate archetypes", () => {
    expect(matchConfidence([spectrum("breadth", 50)])).toBe("emerging");
  });

  it("states the result clearly when the nearest archetype is a decisive win", () => {
    const confident = matchConfidence([spectrum("tone", 75), spectrum("pace", 80), spectrum("breadth", 45)]);
    expect(confident).toBe("clear");
  });
});

describe("archetype copy", () => {
  it("hedges every summary rather than asserting what the user is", () => {
    // "You are…" / "You always…" is exactly the unfalsifiable register the
    // research flagged as the Barnum failure mode.
    for (const a of ARCHETYPES) {
      expect(a.summary).not.toMatch(/\bYou are\b|\bYou always\b|\bYour personality\b/i);
    }
  });

  it("gives every archetype a distinct name and key", () => {
    expect(new Set(ARCHETYPES.map((a) => a.key)).size).toBe(ARCHETYPES.length);
    expect(new Set(ARCHETYPES.map((a) => a.name)).size).toBe(ARCHETYPES.length);
  });
});
