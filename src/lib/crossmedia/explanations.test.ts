import { describe, it, expect } from "vitest";
import { buildConnection, pickBest, tasteAffinity, moodOverlapCount, type CrossMediaSource } from "@/lib/crossmedia/explanations";
import type { ContentCard } from "@/types/content";
import type { TasteSignal } from "@/lib/recommendations/signals";

function makeCard(overrides: Partial<ContentCard> = {}): ContentCard {
  return {
    id: "1",
    kind: "artist",
    slug: "x",
    title: "X",
    imageUrl: "https://example.com/x.jpg",
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

const source: CrossMediaSource = { title: "Interstellar", moods: ["Atmospheric", "Melancholic"], genres: ["Sci-Fi"] };

describe("moodOverlapCount", () => {
  it("counts shared moods between candidate and source", () => {
    expect(moodOverlapCount(["Atmospheric", "Dark"], ["Atmospheric", "Melancholic"])).toBe(1);
    expect(moodOverlapCount(["Whimsical"], ["Atmospheric", "Melancholic"])).toBe(0);
  });
});

describe("tasteAffinity", () => {
  it("is 0 when the signal has no overlap with the candidate", () => {
    const card = makeCard({ genres: ["Horror"], moods: ["Tense"] });
    const signal = makeSignal({ genreWeights: new Map([["Sci-Fi", 5]]) });
    expect(tasteAffinity(card, signal)).toBe(0);
  });

  it("sums genre and mood weight contributions", () => {
    const card = makeCard({ genres: ["Sci-Fi"], moods: ["Atmospheric"] });
    const signal = makeSignal({ genreWeights: new Map([["Sci-Fi", 3]]), moodWeights: new Map([["Atmospheric", 5]]) });
    expect(tasteAffinity(card, signal)).toBe(3 + 5 * 0.6);
  });
});

describe("buildConnection", () => {
  it("labels a connection MOOD_BASED and cites the shared mood when there's no real taste signal for it", () => {
    const card = makeCard({ moods: ["Atmospheric"] });
    const signal = makeSignal();
    const connection = buildConnection(card, source, signal, "Enter the mood");
    expect(connection.relationshipType).toBe("MOOD_BASED");
    expect(connection.reason).toContain("atmospheric");
    expect(connection.reason).toContain("Interstellar");
  });

  it("labels a connection TASTE_BASED and cites the user's real genre/mood weight once affinity is strong", () => {
    const card = makeCard({ genres: ["Sci-Fi"], moods: ["Atmospheric"] });
    const signal = makeSignal({ genreWeights: new Map([["Sci-Fi", 5]]), moodWeights: new Map([["Atmospheric", 5]]) });
    const connection = buildConnection(card, source, signal, "Explore the artist");
    expect(connection.relationshipType).toBe("TASTE_BASED");
    expect(connection.reason).toContain("sci-fi");
  });

  it("never fabricates a reason for a candidate with zero mood overlap and zero taste affinity", () => {
    const card = makeCard({ moods: ["Whimsical"] });
    const signal = makeSignal();
    const connection = buildConnection(card, source, signal, "Watch next");
    expect(connection.reason).toBe("A different medium, same atmosphere as Interstellar.");
  });
});

describe("pickBest", () => {
  it("ranks higher-affinity, higher-overlap candidates first and respects the count cap", () => {
    const weak = makeCard({ id: "weak", moods: ["Melancholic"] });
    const strong = makeCard({ id: "strong", genres: ["Sci-Fi"], moods: ["Atmospheric", "Melancholic"] });
    const irrelevant = makeCard({ id: "irrelevant", moods: ["Whimsical"] });
    const signal = makeSignal({ genreWeights: new Map([["Sci-Fi", 5]]) });

    const result = pickBest([irrelevant, weak, strong], source, signal, 2, "Listen next");
    expect(result.length).toBe(2);
    expect(result[0].card.id).toBe("strong");
  });
});
