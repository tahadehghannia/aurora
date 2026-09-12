import { describe, it, expect } from "vitest";
import { diversify } from "@/lib/recommendations/diversify";
import type { ScoredCandidate } from "@/lib/recommendations/hybrid";
import type { ContentCard } from "@/types/content";

function makeCandidate(overrides: Partial<ContentCard> & { score: number; contentScore: number }): ScoredCandidate {
  const { score, contentScore, ...cardOverrides } = overrides;
  const card: ContentCard = {
    id: cardOverrides.id ?? Math.random().toString(36),
    kind: "movie",
    slug: "x",
    title: "X",
    imageUrl: "https://example.com/x.jpg",
    genres: ["Sci-Fi"],
    moods: [],
    ...cardOverrides,
  };
  return { card, score, contentScore, source: "HYBRID" };
}

describe("diversify", () => {
  it("returns up to `limit` items, never more", () => {
    const ranked = Array.from({ length: 30 }, (_, i) => makeCandidate({ id: `${i}`, score: 30 - i, contentScore: 5 }));
    const result = diversify(ranked, { limit: 10 });
    expect(result.length).toBe(10);
  });

  it("never returns duplicate items", () => {
    const ranked = Array.from({ length: 20 }, (_, i) => makeCandidate({ id: `${i}`, score: 20 - i, contentScore: 5 }));
    const result = diversify(ranked, { limit: 12 });
    const ids = result.map((r) => r.card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("caps how many items share the same primary genre, even within the strong-fit tier", () => {
    // Enough distinct genres that 10 items *can* be assembled within a cap
    // of 4 per genre (3 x 4 = 12 >= 10) — otherwise hitting `limit` forces a
    // graceful, deliberate cap overrun (covered by the next test).
    const sciFi = Array.from({ length: 15 }, (_, i) => makeCandidate({ id: `scifi-${i}`, genres: ["Sci-Fi"], score: 100 - i, contentScore: 10 }));
    const drama = Array.from({ length: 15 }, (_, i) => makeCandidate({ id: `drama-${i}`, genres: ["Drama"], score: 50 - i, contentScore: 10 }));
    const comedy = Array.from({ length: 15 }, (_, i) => makeCandidate({ id: `comedy-${i}`, genres: ["Comedy"], score: 20 - i, contentScore: 10 }));
    const result = diversify([...sciFi, ...drama, ...comedy], { limit: 10, maxPerPrimaryGenre: 4 });

    const sciFiCount = result.filter((r) => r.card.genres?.[0] === "Sci-Fi").length;
    expect(sciFiCount).toBeLessThanOrEqual(4);
    expect(result.length).toBe(10);
  });

  it("allows the cap to be exceeded only when there truly isn't enough genre variety to fill `limit` otherwise", () => {
    // Only 2 genres and a cap of 4 (max 8 compliant items) but limit is 10 —
    // returning fewer than `limit` would be worse than a slight cap overrun.
    const sciFi = Array.from({ length: 15 }, (_, i) => makeCandidate({ id: `scifi-${i}`, genres: ["Sci-Fi"], score: 100 - i, contentScore: 10 }));
    const drama = Array.from({ length: 15 }, (_, i) => makeCandidate({ id: `drama-${i}`, genres: ["Drama"], score: 50 - i, contentScore: 10 }));
    const result = diversify([...sciFi, ...drama], { limit: 10, maxPerPrimaryGenre: 4 });

    expect(result.length).toBe(10);
  });

  it("gracefully fills the list from weaker tiers when the strong-fit bucket is thin (cold start)", () => {
    // Only one strong-fit candidate — everything else is pure popularity (contentScore 0).
    const ranked = [
      makeCandidate({ id: "strong", score: 50, contentScore: 8 }),
      ...Array.from({ length: 20 }, (_, i) => makeCandidate({ id: `pop-${i}`, score: 40 - i, contentScore: 0 })),
    ];
    const result = diversify(ranked, { limit: 10 });
    expect(result.length).toBe(10);
  });

  it("preserves descending score order in the final output", () => {
    const ranked = Array.from({ length: 15 }, (_, i) => makeCandidate({ id: `${i}`, score: 15 - i, contentScore: 5 }));
    const result = diversify(ranked, { limit: 8 });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});
