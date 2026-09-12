import { describe, it, expect } from "vitest";
import { scorePopularity } from "@/lib/recommendations/popularity";

describe("scorePopularity", () => {
  it("scales linearly with raw popularity when no year is given", () => {
    expect(scorePopularity(0)).toBe(0);
    expect(scorePopularity(50)).toBe(0.5);
    expect(scorePopularity(100)).toBe(1);
  });

  it("gives a full recency boost to something released this year", () => {
    const thisYear = new Date().getFullYear();
    const withYear = scorePopularity(50, thisYear);
    const withoutYear = scorePopularity(50);

    expect(withYear).toBeGreaterThan(withoutYear);
    expect(withYear).toBeCloseTo(0.5 + 0.5, 5);
  });

  it("never gives a negative recency boost for very old content", () => {
    const veryOld = scorePopularity(50, 1950);
    expect(veryOld).toBeCloseTo(0.5, 5);
  });

  it("fades the recency boost out as content ages", () => {
    const thisYear = new Date().getFullYear();
    const recent = scorePopularity(0, thisYear - 1);
    const older = scorePopularity(0, thisYear - 5);

    expect(recent).toBeGreaterThan(older);
  });
});
