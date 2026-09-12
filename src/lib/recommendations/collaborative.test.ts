import { describe, it, expect } from "vitest";
import { scoreCollaborative, itemKey, type CollaborativeModel } from "@/lib/recommendations/collaborative";

function makeModel(raters: Record<string, Record<string, number>>, minRatersForSignal = 3): CollaborativeModel {
  const itemRatings = new Map(
    Object.entries(raters).map(([key, userScores]) => [key, { raters: new Map(Object.entries(userScores)) }])
  );
  return { itemRatings, minRatersForSignal };
}

describe("scoreCollaborative", () => {
  it("returns 0 when the candidate has fewer raters than the trust threshold", () => {
    const model = makeModel({
      "ALBUM:candidate": { u1: 5, u2: 4 }, // only 2 raters, threshold is 3
      "ALBUM:liked": { u1: 5, u2: 5, u3: 4 },
    });

    const score = scoreCollaborative(
      "ALBUM:candidate",
      [{ key: "ALBUM:liked", score: 5 }],
      model
    );
    expect(score).toBe(0);
  });

  it("scores highly when the candidate is co-rated identically to something the user loved", () => {
    const model = makeModel({
      "ALBUM:candidate": { u1: 5, u2: 4, u3: 5 },
      "ALBUM:liked": { u1: 5, u2: 4, u3: 5 },
    });

    const score = scoreCollaborative("ALBUM:candidate", [{ key: "ALBUM:liked", score: 5 }], model);
    expect(score).toBeGreaterThan(2);
  });

  it("contributes a negative score when correlated with something the user rated poorly", () => {
    const model = makeModel({
      "ALBUM:candidate": { u1: 5, u2: 4, u3: 5 },
      "ALBUM:disliked": { u1: 5, u2: 4, u3: 5 }, // identical co-rating pattern to candidate
    });

    const score = scoreCollaborative("ALBUM:candidate", [{ key: "ALBUM:disliked", score: 1 }], model);
    expect(score).toBeLessThan(0);
  });

  it("ignores the candidate itself if it appears in the user's own rating list", () => {
    const model = makeModel({
      "ALBUM:candidate": { u1: 5, u2: 4, u3: 5 },
    });

    const score = scoreCollaborative("ALBUM:candidate", [{ key: "ALBUM:candidate", score: 5 }], model);
    expect(score).toBe(0);
  });

  it("skips comparison items that aren't in the model", () => {
    const model = makeModel({
      "ALBUM:candidate": { u1: 5, u2: 4, u3: 5 },
    });

    const score = scoreCollaborative("ALBUM:candidate", [{ key: "ALBUM:unknown", score: 5 }], model);
    expect(score).toBe(0);
  });
});

describe("itemKey", () => {
  it("joins content type and id with a colon", () => {
    expect(itemKey("ALBUM", "abc123")).toBe("ALBUM:abc123");
  });
});
