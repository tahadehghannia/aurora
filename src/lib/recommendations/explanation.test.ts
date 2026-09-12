import { describe, it, expect } from "vitest";
import { explainRecommendation, explainRecommendationChecklist } from "@/lib/recommendations/explanation";
import { buildRecommendationReasons } from "@/lib/recommendations/reasons";
import type { ContentCard } from "@/types/content";
import type { TasteSignal } from "@/lib/recommendations/signals";
import type { CollaborativeModel } from "@/lib/recommendations/collaborative";

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

describe("explainRecommendation", () => {
  it("prefers a direct rated match over a weaker genre/save match", () => {
    const card = makeCard({ genres: ["Sci-Fi"] });
    const signal = makeSignal({
      genreWeights: new Map([["Sci-Fi", 3]]),
      likedTitles: [{ title: "Interstellar", kind: "movie", genres: ["Sci-Fi"], score: 5 }],
      hasSignal: true,
    });

    expect(explainRecommendation(card, signal)).toBe("Because you rated Interstellar 5.0/5.");
  });

  it("cites a saved-but-unrated title when there's no rated match", () => {
    const card = makeCard({ genres: ["Sci-Fi"] });
    const signal = makeSignal({
      likedTitles: [{ title: "The Long Orbit", kind: "movie", genres: ["Sci-Fi"] }],
      hasSignal: true,
    });

    expect(explainRecommendation(card, signal)).toBe("Because you saved The Long Orbit.");
  });

  it("falls back to a genre affinity explanation with no liked-title overlap", () => {
    const card = makeCard({ genres: ["Electronic"] });
    const signal = makeSignal({ genreWeights: new Map([["Electronic", 5]]), hasSignal: true });

    expect(explainRecommendation(card, signal)).toBe("Because you often enjoy electronic.");
  });

  it("uses qualified, uncertain language when genre evidence is weak", () => {
    const card = makeCard({ genres: ["Electronic"] });
    const signal = makeSignal({ genreWeights: new Map([["Electronic", 0.5]]), hasSignal: true });

    const text = explainRecommendation(card, signal);
    expect(text).toContain("may fit your taste");
    expect(text).not.toContain("often enjoy");
  });

  it("falls back to a mood explanation when only moods overlap", () => {
    const card = makeCard({ moods: ["Atmospheric"] });
    const signal = makeSignal({ moodWeights: new Map([["Atmospheric", 5]]), hasSignal: true });

    expect(explainRecommendation(card, signal)).toBe("It matches the atmospheric mood you gravitate toward.");
  });

  it("falls back to a genre-scoped popularity explanation for a brand-new user with no signal", () => {
    const card = makeCard({ genres: ["Horror"] });
    const signal = makeSignal({ hasSignal: false });

    expect(explainRecommendation(card, signal)).toBe("Popular among people exploring horror.");
  });

  it("falls back to a fully generic popularity line when there's no genre to name either", () => {
    const card = makeCard();
    const signal = makeSignal({ hasSignal: false });

    expect(explainRecommendation(card, signal)).toBe("Popular with Aurora members right now.");
  });

  it("falls back to a generic exploration message when there is signal but no overlap", () => {
    const card = makeCard({ genres: ["Horror"] });
    const signal = makeSignal({ genreWeights: new Map([["Sci-Fi", 4]]), hasSignal: true });

    expect(explainRecommendation(card, signal)).toBe("Something a little different from your usual taste — worth a look.");
  });

  it("credits the artist affinity directly rather than name-dropping an unrelated liked artist", () => {
    // Regression test: rating "Radiohead" (an artist, genre "Alternative") used to make
    // every other Alternative artist's album say "Because you liked Radiohead" — wrong,
    // since they're unrelated artists that merely share a genre tag.
    const card = makeCard({
      kind: "album",
      genres: ["Alternative"],
      subtitle: "Phoebe Bridgers",
      artistId: "phoebe-bridgers-id",
    });
    const signal = makeSignal({
      genreWeights: new Map([["Alternative", 5]]),
      artistWeights: new Map([["radiohead-id", 2]]), // affinity for Radiohead, NOT Phoebe Bridgers
      likedTitles: [{ title: "Radiohead", kind: "artist", genres: ["Alternative"], score: 5 }],
      hasSignal: true,
    });

    const reason = explainRecommendation(card, signal);
    expect(reason).not.toContain("Radiohead");
    expect(reason).toBe("Because you often enjoy alternative.");
  });

  it("does credit the artist affinity when the candidate is actually by that artist", () => {
    const card = makeCard({ kind: "album", genres: ["Alternative"], subtitle: "Radiohead", artistId: "radiohead-id" });
    const signal = makeSignal({
      artistWeights: new Map([["radiohead-id", 5]]),
      likedTitles: [{ title: "Radiohead", kind: "artist", genres: ["Alternative"], artistId: "radiohead-id", score: 5 }],
      hasSignal: true,
    });

    expect(explainRecommendation(card, signal)).toBe("Because you rated Radiohead 5.0/5.");
  });
});

describe("explainRecommendationChecklist", () => {
  it("returns nothing when there is no signal at all", () => {
    const card = makeCard({ genres: ["Sci-Fi"] });
    const signal = makeSignal({ hasSignal: false });

    expect(explainRecommendationChecklist(card, signal)).toEqual([]);
  });

  it("leads with an actual 4+ rating on a genre-matching title, citing the real score", () => {
    const card = makeCard({ genres: ["Sci-Fi"] });
    const signal = makeSignal({
      genreWeights: new Map([["Sci-Fi", 3]]),
      likedTitles: [{ title: "Interstellar", kind: "movie", genres: ["Sci-Fi"], score: 5 }],
      hasSignal: true,
    });

    const reasons = explainRecommendationChecklist(card, signal);
    expect(reasons[0]).toBe("Because you rated Interstellar 5.0/5.");
  });

  it("never cites a rating that doesn't share genre, artist or creator with the candidate", () => {
    const card = makeCard({ genres: ["Horror"] });
    const signal = makeSignal({
      likedTitles: [{ title: "Interstellar", kind: "movie", genres: ["Sci-Fi"], score: 5 }],
      hasSignal: true,
    });

    const reasons = explainRecommendationChecklist(card, signal);
    expect(reasons.join(" ")).not.toContain("Interstellar");
  });

  it("includes a director-affinity line only when the candidate's own creator has real weight", () => {
    const card = makeCard({ creator: "Denis Villeneuve" });
    const signal = makeSignal({
      directorWeights: new Map([["Denis Villeneuve", 4]]),
      hasSignal: true,
    });

    expect(explainRecommendationChecklist(card, signal)).toContain("You've liked other work from Denis Villeneuve.");
  });

  it("never includes the generic exploration/popularity fallback as a checklist line", () => {
    const card = makeCard({ genres: ["Horror"] });
    const signal = makeSignal({ genreWeights: new Map([["Sci-Fi", 4]]), hasSignal: true });

    expect(explainRecommendationChecklist(card, signal)).toEqual([]);
  });

  it("caps the checklist at 4 reasons and de-dupes", () => {
    const card = makeCard({ genres: ["Sci-Fi"], moods: ["Atmospheric"], creator: "Denis Villeneuve", artistId: "a1", subtitle: "Some Artist" });
    const signal = makeSignal({
      genreWeights: new Map([["Sci-Fi", 3]]),
      moodWeights: new Map([["Atmospheric", 3]]),
      directorWeights: new Map([["Denis Villeneuve", 3]]),
      artistWeights: new Map([["a1", 3]]),
      likedTitles: [{ title: "Interstellar", kind: "movie", genres: ["Sci-Fi"], score: 5 }],
      hasSignal: true,
    });

    const reasons = explainRecommendationChecklist(card, signal);
    expect(reasons.length).toBeLessThanOrEqual(4);
    expect(new Set(reasons).size).toBe(reasons.length);
  });

  it("includes a recent-behavior line when the last-14-day signal (not all-time) supports it", () => {
    const card = makeCard({ genres: ["Documentary"] });
    const signal = makeSignal({
      recentGenreWeights: new Map([["Documentary", 2]]),
      hasSignal: true,
    });

    expect(explainRecommendationChecklist(card, signal)).toContain("You've recently been exploring documentary.");
  });
});

describe("buildRecommendationReasons — structured data model", () => {
  it("assigns priority 1 to a direct rated match and sorts it first even when other signals are stronger elsewhere", () => {
    const card = makeCard({ genres: ["Sci-Fi"], moods: ["Atmospheric"] });
    const signal = makeSignal({
      genreWeights: new Map([["Sci-Fi", 10]]),
      moodWeights: new Map([["Atmospheric", 10]]),
      likedTitles: [{ title: "Interstellar", kind: "movie", genres: ["Sci-Fi"], score: 5 }],
      hasSignal: true,
    });

    const reasons = buildRecommendationReasons(card, signal);
    expect(reasons[0].reasonType).toBe("LIKED_CONTENT");
    expect(reasons[0].priority).toBe(1);
    expect(reasons[0].confidence).toBe("high");
  });

  it("marks weak genre evidence as low confidence and strong evidence as high confidence", () => {
    const weakCard = makeCard({ genres: ["Jazz"] });
    const weakSignal = makeSignal({ genreWeights: new Map([["Jazz", 0.5]]), hasSignal: true });
    expect(buildRecommendationReasons(weakCard, weakSignal)[0].confidence).toBe("low");

    const strongCard = makeCard({ genres: ["Jazz"] });
    const strongSignal = makeSignal({ genreWeights: new Map([["Jazz", 6]]), hasSignal: true });
    expect(buildRecommendationReasons(strongCard, strongSignal)[0].confidence).toBe("high");
  });

  it("adds a real COMMUNITY_SIGNAL reason only when the candidate has enough raters and a positive collaborative score", () => {
    const card = makeCard({ id: "movie-1", kind: "movie" });
    const signal = makeSignal({ hasSignal: true });

    const model: CollaborativeModel = {
      itemRatings: new Map([
        ["MOVIE:movie-1", { raters: new Map([["u1", 5], ["u2", 4.5], ["u3", 5]]) }],
        ["MOVIE:seed-1", { raters: new Map([["u1", 5], ["u2", 4.5], ["u3", 5]]) }],
      ]),
      minRatersForSignal: 3,
    };
    const community = { model, userRatings: [{ key: "MOVIE:seed-1", score: 5 }] };

    const reasons = buildRecommendationReasons(card, signal, community);
    expect(reasons.some((r) => r.reasonType === "COMMUNITY_SIGNAL")).toBe(true);
  });

  it("never adds a COMMUNITY_SIGNAL reason when the candidate has too few raters to trust the pattern", () => {
    const card = makeCard({ id: "movie-1", kind: "movie" });
    const signal = makeSignal({ hasSignal: true });

    const model: CollaborativeModel = {
      itemRatings: new Map([["MOVIE:movie-1", { raters: new Map([["u1", 5]]) }]]),
      minRatersForSignal: 3,
    };
    const community = { model, userRatings: [{ key: "MOVIE:seed-1", score: 5 }] };

    const reasons = buildRecommendationReasons(card, signal, community);
    expect(reasons.some((r) => r.reasonType === "COMMUNITY_SIGNAL")).toBe(false);
  });

  it("every reason carries a discoveryHref only when there's a real destination (genre/mood/creator), never a fabricated one", () => {
    const card = makeCard({ genres: ["Sci-Fi"] });
    const signal = makeSignal({ genreWeights: new Map([["Sci-Fi", 5]]), hasSignal: true });

    const reasons = buildRecommendationReasons(card, signal);
    expect(reasons[0].discoveryHref).toBe("/discover?genre=sci-fi");
  });
});
