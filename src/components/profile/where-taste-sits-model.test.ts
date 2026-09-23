import { describe, it, expect } from "vitest";
import {
  clusterOffset,
  describeLean,
  spokenPosition,
  EDGE_PADDING,
  FRAME_SPREAD,
} from "@/components/profile/where-taste-sits-model";
import type { TasteSpectrum } from "@/lib/taste/identity-types";

function axis(position: number): TasteSpectrum {
  return {
    key: "pace",
    leftLabel: "Fast-paced",
    rightLabel: "Slow-burn",
    position,
    sampleSize: 12,
    evidence: "7 of 12 titles lean toward slower, unfolding stories.",
    exemplars: [],
  };
}

describe("describeLean", () => {
  it("names the pole the user actually sits nearer", () => {
    expect(describeLean(axis(85)).label).toBe("Slow-burn");
    expect(describeLean(axis(15)).label).toBe("Fast-paced");
  });

  it("distinguishes a strong lean from a slight one", () => {
    expect(describeLean(axis(85)).strength).toBe("Leans strongly toward");
    expect(describeLean(axis(65)).strength).toBe("Leans toward");
  });

  it("says 'balanced' rather than inventing a winner near the middle", () => {
    const lean = describeLean(axis(52));
    expect(lean.strength).toBe("Balanced between");
    // Neither pole is emphasised, so the UI has no side to highlight.
    expect(lean.leansRight).toBeNull();
    expect(lean.label).toBe("Fast-paced and Slow-burn");
  });

  it("treats the exact centre as balanced", () => {
    expect(describeLean(axis(50)).leansRight).toBeNull();
  });
});

describe("clusterOffset", () => {
  it("centres the cluster on the marker away from the edges", () => {
    const positions = [0, 1, 2, 3].map((i) => clusterOffset(i, 4, 50));
    const mean = positions.reduce((a, b) => a + b, 0) / positions.length;
    expect(mean).toBeCloseTo(50, 5);
  });

  it("keeps even spacing between frames", () => {
    const positions = [0, 1, 2, 3].map((i) => clusterOffset(i, 4, 50));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]! - positions[i - 1]!).toBeCloseTo(FRAME_SPREAD, 5);
    }
  });

  it("preserves the spread at an extreme instead of collapsing the cluster", () => {
    // The bug this guards: clamping each frame individually stacked all four on
    // one point exactly where the lean was strongest.
    const positions = [0, 1, 2, 3].map((i) => clusterOffset(i, 4, 2));
    expect(new Set(positions).size).toBe(4);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]! - positions[i - 1]!).toBeCloseTo(FRAME_SPREAD, 5);
    }
  });

  it("keeps every frame on the axis at both extremes", () => {
    for (const position of [0, 3, 50, 97, 100]) {
      for (const index of [0, 1, 2, 3]) {
        const offset = clusterOffset(index, 4, position);
        expect(offset).toBeGreaterThanOrEqual(EDGE_PADDING - 0.001);
        expect(offset).toBeLessThanOrEqual(100 - EDGE_PADDING + 0.001);
      }
    }
  });

  it("handles a single frame", () => {
    expect(clusterOffset(0, 1, 40)).toBeCloseTo(40, 5);
  });
});

describe("spokenPosition", () => {
  it("states the reading and the evidence without relying on the visual", () => {
    const spoken = spokenPosition(axis(85));
    expect(spoken).toContain("Fast-paced to Slow-burn");
    expect(spoken).toContain("Leans strongly toward Slow-burn");
    expect(spoken).toContain("7 of 12 titles");
  });

  it("describes a balanced axis honestly", () => {
    expect(spokenPosition(axis(50))).toContain("Balanced between Fast-paced and Slow-burn");
  });
});
