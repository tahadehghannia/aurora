import { describe, it, expect } from "vitest";
import { scoreContentBased } from "@/lib/recommendations/contentBased";
import type { ContentCard } from "@/types/content";
import type { TasteSignal } from "@/lib/recommendations/signals";

function makeCard(overrides: Partial<ContentCard> = {}): ContentCard {
  return {
    id: "1",
    kind: "movie",
    slug: "test-movie",
    title: "Test Movie",
    imageUrl: "https://example.com/poster.jpg",
    genres: [],
    moods: [],
    ...overrides,
  };
}

function makeSignal(overrides: Partial<TasteSignal> = {}): TasteSignal {
  return {
    genreWeights: new Map(),
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
    hasSignal: false,
    ...overrides,
  };
}

describe("scoreContentBased", () => {
  it("returns 0 for a candidate with no genre/mood overlap", () => {
    const card = makeCard({ genres: ["Horror"], moods: ["Dark"] });
    const signal = makeSignal({
      genreWeights: new Map([["Sci-Fi", 5]]),
      moodWeights: new Map([["Uplifting", 3]]),
    });

    expect(scoreContentBased(card, signal)).toBe(0);
  });

  it("sums genre weights across every matching genre", () => {
    const card = makeCard({ genres: ["Sci-Fi", "Drama"] });
    const signal = makeSignal({
      genreWeights: new Map([
        ["Sci-Fi", 4],
        ["Drama", 2],
      ]),
    });

    expect(scoreContentBased(card, signal)).toBe(6);
  });

  it("weighs mood overlap at 60% of genre overlap", () => {
    const card = makeCard({ moods: ["Atmospheric"] });
    const signal = makeSignal({ moodWeights: new Map([["Atmospheric", 10]]) });

    expect(scoreContentBased(card, signal)).toBe(6);
  });

  it("lets a strong negative genre weight (from a low rating) pull the score below zero", () => {
    const card = makeCard({ genres: ["Horror"] });
    const signal = makeSignal({ genreWeights: new Map([["Horror", -2]]) });

    expect(scoreContentBased(card, signal)).toBe(-2);
  });

  it("weighs director affinity at 120% when the candidate's own creator has weight", () => {
    const card = makeCard({ creator: "Denis Villeneuve" });
    const signal = makeSignal({ directorWeights: new Map([["Denis Villeneuve", 5]]) });

    expect(scoreContentBased(card, signal)).toBe(6);
  });
});
