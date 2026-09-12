import { describe, it, expect } from "vitest";
import { rankCandidates, scoreCandidate, diversify, type RankContext } from "@/lib/mood/rank";
import type { MoodCandidate, CandidateSource } from "@/lib/mood/candidates";
import { moodIntentSchema, type MoodIntent } from "@/lib/mood/intent";

function candidate(
  id: string,
  genres: string[],
  moods: string[],
  extra: Partial<MoodCandidate> & { rating?: number; creator?: string } = {}
): MoodCandidate {
  return {
    card: {
      id,
      kind: "movie",
      slug: id,
      title: id,
      imageUrl: "",
      genres,
      moods,
      rating: extra.rating ?? 7,
      ...(extra.creator ? { creator: extra.creator } : {}),
    },
    runtimeMin: extra.runtimeMin ?? 110,
    year: extra.year ?? 2018,
    language: "en",
    sources: (extra.sources as CandidateSource[]) ?? ["mood"],
  };
}

function context(overrides: Partial<RankContext> = {}): RankContext {
  return {
    intent: moodIntentSchema.parse({}),
    exploration: "balanced",
    similar: null,
    genreWeights: new Map(),
    moodWeights: new Map(),
    recentGenreWeights: new Map(),
    directorWeights: new Map(),
    likedTitles: [],
    softDownranked: new Set(),
    hasSignal: true,
    ...overrides,
  };
}

const CALM_INTENT: MoodIntent = moodIntentSchema.parse({
  moods: ["Calm", "Atmospheric", "Dreamy", "Comforting"],
  genres: ["Drama", "Documentary", "Animation"],
  excludeGenres: ["Horror"],
});

describe("personalization (§7)", () => {
  // The single most important property of this feature: the same words must
  // not produce the same list for two different people.
  const pool = [
    candidate("Atmospheric Sci-Fi", ["Sci-Fi"], ["Atmospheric", "Thought-provoking"]),
    candidate("Quiet Space Film", ["Sci-Fi"], ["Atmospheric", "Dreamy"]),
    candidate("Warm Comedy", ["Comedy"], ["Comforting", "Uplifting"]),
    candidate("Character Drama", ["Drama"], ["Comforting", "Emotion-focused"]),
  ];

  it("gives a sci-fi/atmospheric user atmospheric sci-fi for 'something calm'", () => {
    const ranked = rankCandidates(
      pool,
      context({
        intent: CALM_INTENT,
        genreWeights: new Map([["Sci-Fi", 6]]),
        moodWeights: new Map([["Atmospheric", 5]]),
      })
    );
    expect(ranked[0]?.candidate.card.genres?.[0]).toBe("Sci-Fi");
  });

  it("gives a drama/comedy user character-driven work for the very same request", () => {
    const ranked = rankCandidates(
      pool,
      context({
        intent: CALM_INTENT,
        genreWeights: new Map([
          ["Drama", 6],
          ["Comedy", 5],
        ]),
        moodWeights: new Map([["Comforting", 5]]),
      })
    );
    expect(["Drama", "Comedy"]).toContain(ranked[0]?.candidate.card.genres?.[0]);
  });
});

describe("reason selection (§16, §36)", () => {
  it("names the creator when creator affinity is what won", () => {
    const scored = scoreCandidate(candidate("A", ["Drama"], [], { creator: "Denis Villeneuve" }), context({
      directorWeights: new Map([["Denis Villeneuve", 5]]),
    }));
    expect(scored.reasonType).toBe("CREATOR_MATCH");
    expect(scored.reason).toContain("Denis Villeneuve");
  });

  it("cites a specific rated title rather than a generic affinity when one exists", () => {
    const scored = scoreCandidate(candidate("A", ["Sci-Fi"], []), context({
      genreWeights: new Map([["Sci-Fi", 8]]),
      likedTitles: [{ title: "Interstellar", genres: ["Sci-Fi"], score: 5 }],
    }));
    expect(scored.reasonType).toBe("TASTE_MATCH");
    expect(scored.reason).toBe("Because you rated Interstellar 5/5.");
  });

  it("never makes a taste claim for a user with no history (§40)", () => {
    const scored = scoreCandidate(
      candidate("A", ["Sci-Fi"], ["Atmospheric"]),
      context({ hasSignal: false, genreWeights: new Map([["Sci-Fi", 9]]), intent: CALM_INTENT })
    );
    expect(scored.tasteBacked).toBe(false);
    expect(scored.reason).not.toMatch(/you often enjoy|because you rated/i);
  });

  it("falls back to a community claim when nothing else is true", () => {
    const scored = scoreCandidate(candidate("A", ["Western"], []), context({ hasSignal: false }));
    expect(scored.reason).toBe("Highly rated by the Aurora community.");
  });
});

describe("runtime handling (§21)", () => {
  const intent = moodIntentSchema.parse({ runtimeMaxMin: 90 });

  it("rewards a title that provably fits the stated time", () => {
    const fits = scoreCandidate(candidate("Short", ["Drama"], [], { runtimeMin: 88 }), context({ intent }));
    expect(fits.reasonType).toBe("RUNTIME_MATCH");
    expect(fits.reason).toContain("88 minutes");
  });

  it("ranks an unknown runtime below a known fit instead of assuming it fits", () => {
    const known = scoreCandidate(candidate("Known", ["Drama"], [], { runtimeMin: 88 }), context({ intent }));
    const unknown = scoreCandidate(
      { ...candidate("Unknown", ["Drama"], []), runtimeMin: null },
      context({ intent })
    );
    expect(known.score).toBeGreaterThan(unknown.score);
    expect(unknown.reason).not.toMatch(/fits the time/i);
  });
});

describe("exploration modes (§19)", () => {
  const pool = [
    candidate("On-taste", ["Sci-Fi"], [], { rating: 7 }),
    candidate("Hidden gem", ["History"], [], { rating: 8, sources: ["hidden_gem"] }),
  ];
  const base = { genreWeights: new Map([["Sci-Fi", 10]]) };

  it("'close' keeps the user inside their established taste", () => {
    const ranked = rankCandidates(pool, context({ ...base, exploration: "close" }));
    expect(ranked[0]?.candidate.card.id).toBe("On-taste");
  });

  it("'surprise' moves them out of it without discarding relevance", () => {
    const ranked = rankCandidates(pool, context({ ...base, exploration: "surprise" }));
    expect(ranked[0]?.candidate.card.id).toBe("Hidden gem");
    expect(ranked[0]?.reasonType).toBe("EXPLORATION");
  });
});

describe("feedback and diversity", () => {
  it("ranks down a title the user said 'less like this' about, without removing it", () => {
    const pool = [candidate("Downranked", ["Drama"], ["Calm"]), candidate("Normal", ["Drama"], [])];
    const ranked = rankCandidates(
      pool,
      context({ intent: CALM_INTENT, softDownranked: new Set(["movie:Downranked"]) })
    );
    expect(ranked[0]?.candidate.card.id).toBe("Normal");
    expect(ranked.map((r) => r.candidate.card.id)).toContain("Downranked");
  });

  it("caps a single genre so a strong signal can't collapse the list (§20)", () => {
    const pool = [
      ...Array.from({ length: 8 }, (_, i) => candidate(`SciFi${i}`, ["Sci-Fi"], [])),
      candidate("Drama1", ["Drama"], []),
      candidate("Comedy1", ["Comedy"], []),
    ];
    const ranked = rankCandidates(pool, context({ genreWeights: new Map([["Sci-Fi", 10]]) }));
    const picked = diversify(ranked, 5, 3);
    const sciFi = picked.filter((p) => p.candidate.card.genres?.[0] === "Sci-Fi");
    expect(sciFi.length).toBe(3);
    expect(picked.length).toBe(5);
  });

  it("fills to the requested size rather than returning a short list", () => {
    const pool = Array.from({ length: 6 }, (_, i) => candidate(`SciFi${i}`, ["Sci-Fi"], []));
    const picked = diversify(rankCandidates(pool, context()), 5, 2);
    expect(picked.length).toBe(5);
    expect(new Set(picked.map((p) => p.candidate.card.id)).size).toBe(5);
  });
});
