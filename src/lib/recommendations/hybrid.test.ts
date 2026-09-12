import { describe, it, expect } from "vitest";
import { rankCandidates } from "@/lib/recommendations/hybrid";
import type { ContentCard } from "@/types/content";
import type { TasteSignal } from "@/lib/recommendations/signals";

function makeCard(id: string, overrides: Partial<ContentCard> = {}): ContentCard {
  return {
    id,
    kind: "movie",
    slug: `m-${id}`,
    title: `Movie ${id}`,
    imageUrl: "https://example.com/p.jpg",
    genres: ["Sci-Fi"],
    moods: [],
    popularity: 50,
    ...overrides,
  };
}

function makeSignal(overrides: Partial<TasteSignal> = {}): TasteSignal {
  return {
    genreWeights: new Map([["Sci-Fi", 5]]),
    moodWeights: new Map(),
    artistWeights: new Map(),
    directorWeights: new Map(),
    actorWeights: new Map(),
    recentGenreWeights: new Map(),
    recentMoodWeights: new Map(),
    likedTitles: [],
    seen: { movieIds: new Set(), showIds: new Set(), albumIds: new Set(), artistIds: new Set() },
    softDownranked: new Set(),
    mutedCreators: [],
    hasSignal: true,
    ...overrides,
  };
}

describe("rankCandidates — 'Less like this' soft downrank", () => {
  it("ranks a downranked item below an otherwise-identical one", () => {
    const a = makeCard("a");
    const b = makeCard("b");
    const signal = makeSignal({ softDownranked: new Set(["MOVIE:a"]) });

    const ranked = rankCandidates([a, b], signal);
    expect(ranked[0].card.id).toBe("b");
    expect(ranked[1].card.id).toBe("a");
  });

  it("keeps the downranked item in the returned set — it is ranked down, never dropped", () => {
    const a = makeCard("a");
    const signal = makeSignal({ softDownranked: new Set(["MOVIE:a"]) });

    const ranked = rankCandidates([a], signal);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].card.id).toBe("a");
  });

  it("damps proportionately rather than applying a flat penalty that would bury any item", () => {
    // Regression: a fixed -5 penalty buried top-ranked items entirely, making
    // "Less like this" behave like the much stronger "Not for me".
    const card = makeCard("a");
    const plain = rankCandidates([card], makeSignal())[0].score;
    const damped = rankCandidates([card], makeSignal({ softDownranked: new Set(["MOVIE:a"]) }))[0].score;

    expect(damped).toBeLessThan(plain);
    expect(damped).toBeGreaterThan(0);
    expect(damped).toBeCloseTo(plain * 0.5, 5);
  });

  it("leaves candidates the user said nothing about untouched", () => {
    const card = makeCard("a");
    const plain = rankCandidates([card], makeSignal())[0].score;
    const withOtherDownranked = rankCandidates([card], makeSignal({ softDownranked: new Set(["MOVIE:zzz"]) }))[0].score;

    expect(withOtherDownranked).toBe(plain);
  });
});
