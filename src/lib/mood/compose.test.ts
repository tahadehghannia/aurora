import { describe, it, expect } from "vitest";
import {
  composeTitle,
  composeDescription,
  composeWhyThisList,
  personalizationLevel,
} from "@/lib/mood/compose";
import { parseMoodIntent } from "@/lib/mood/intent";
import { diversifyReasons, type ScoredCandidate } from "@/lib/mood/rank";

const GENRES = ["Sci-Fi", "Drama", "Thriller", "Comedy", "Horror", "Romance", "Fantasy", "Action", "Documentary", "Animation", "Mystery"];

function scored(id: string, reason: string, alternatives: string[] = []): ScoredCandidate {
  return {
    candidate: {
      card: { id, kind: "movie", slug: id, title: id, imageUrl: "", genres: ["Drama"], moods: [] },
      runtimeMin: 100,
      year: 2020,
      language: "en",
      sources: ["mood"],
    },
    score: 10,
    reasonType: "MOOD_MATCH",
    reason,
    alternatives: [reason, ...alternatives].map((r, i) => ({
      type: "MOOD_MATCH" as const,
      reason: r,
      value: 10 - i,
    })),
    tasteBacked: false,
  };
}

describe("composeWhyThisList — attribution honesty", () => {
  it("only reports exclusions the user actually stated", () => {
    // "calm" makes Aurora veto Horror, Thriller and Action on its own, but the
    // user only said "not horror". Claiming they asked for the rest is false.
    const intent = parseMoodIntent("Something calm and atmospheric, but not horror", GENRES);
    expect(intent.excludeGenres.length).toBeGreaterThan(1);
    expect(intent.statedExclusions).toEqual(["Horror"]);

    const why = composeWhyThisList({
      intent,
      items: [],
      level: "general",
      tasteGenres: [],
      similarTitle: null,
    });

    expect(why).toContain("Horror was left out, as you asked");
    expect(why).not.toMatch(/thriller.*as you asked/i);
    expect(why).not.toMatch(/action.*as you asked/i);
  });

  it("says nothing about exclusions when the user stated none", () => {
    const intent = parseMoodIntent("something calm", GENRES);
    const why = composeWhyThisList({ intent, items: [], level: "general", tasteGenres: [], similarTitle: null });
    expect(why).not.toMatch(/as you asked/i);
  });

  it("never claims taste knowledge for a user who has none", () => {
    const intent = parseMoodIntent("something funny", GENRES);
    const why = composeWhyThisList({
      intent,
      items: [],
      level: "general",
      tasteGenres: ["Comedy"],
      similarTitle: null,
    });
    expect(why).not.toMatch(/you consistently rate/i);
    expect(why).toMatch(/not yet on your taste/i);
  });
});

describe("composeDescription", () => {
  it("names what is actually in the list, not what was searched for", () => {
    const intent = parseMoodIntent("something calm", GENRES);
    // The 'calm' concept leans Drama/Documentary, but the list came back Fantasy.
    const description = composeDescription(intent, 8, ["Fantasy"]);
    expect(description).toContain("fantasy");
    expect(description).not.toContain("documentary");
  });

  it("states a runtime constraint only when there is one", () => {
    const withLimit = parseMoodIntent("something funny, I only have 90 minutes", GENRES);
    expect(composeDescription(withLimit, 5, ["Comedy"])).toContain("under 90 minutes");
    const without = parseMoodIntent("something funny", GENRES);
    expect(composeDescription(without, 5, ["Comedy"])).not.toMatch(/under \d+ minutes/);
  });
});

describe("composeTitle", () => {
  it("gives a feeling an editorial title rather than restating the prompt", () => {
    const intent = parseMoodIntent("I want something calm for tonight", GENRES);
    const title = composeTitle(intent);
    expect(title.length).toBeGreaterThan(0);
    expect(title.toLowerCase()).not.toContain("ai");
    expect(title).not.toContain("?");
  });

  it("is stable for the same seed and can vary with a new one", () => {
    const intent = parseMoodIntent("something dark", GENRES);
    expect(composeTitle(intent, 0)).toBe(composeTitle(intent, 0));
    const seeds = new Set([0, 1, 2].map((n) => composeTitle(intent, n)));
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe("personalizationLevel", () => {
  it("refuses to claim personalization without a taste signal", () => {
    expect(personalizationLevel([scored("a", "x")], false, "balanced")).toBe("general");
  });

  it("reports exploratory when the user asked to be surprised", () => {
    expect(personalizationLevel([scored("a", "x")], true, "surprise")).toBe("exploratory");
  });
});

describe("diversifyReasons", () => {
  it("varies repeated wording using each item's other true claims", () => {
    const items = [
      scored("a", "the mood you asked for.", ["You often enjoy drama."]),
      scored("b", "the mood you asked for.", ["Because you rated Arrival 5/5."]),
      scored("c", "the mood you asked for.", ["Runs 88 minutes — fits the time you have."]),
    ];
    const reasons = diversifyReasons(items).map((i) => i.reason);
    expect(new Set(reasons).size).toBe(3);
  });

  it("repeats a true reason rather than inventing one when nothing else is available", () => {
    const items = [scored("a", "same reason."), scored("b", "same reason.")];
    const reasons = diversifyReasons(items).map((i) => i.reason);
    expect(reasons).toEqual(["same reason.", "same reason."]);
  });
});
