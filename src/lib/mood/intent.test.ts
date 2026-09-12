import { describe, it, expect } from "vitest";
import {
  parseMoodIntent,
  splitExclusions,
  extractRuntime,
  extractAudience,
  extractRecency,
  extractSimilarTo,
  sanitizeIntent,
  moodIntentSchema,
} from "@/lib/mood/intent";

const GENRES = ["Sci-Fi", "Drama", "Thriller", "Comedy", "Horror", "Romance", "Fantasy", "Action", "Documentary", "Animation", "Mystery", "Crime", "Adventure", "Family", "History"];

describe("splitExclusions", () => {
  it("separates 'dark but not horror'", () => {
    const { included, excluded } = splitExclusions("I want a dark movie but not horror");
    expect(included).toMatch(/dark/i);
    expect(included).not.toMatch(/horror/i);
    expect(excluded).toMatch(/horror/i);
  });

  it("separates 'emotional but not depressing'", () => {
    const { excluded } = splitExclusions("something emotional but not depressing");
    expect(excluded).toMatch(/depressing/i);
  });

  it("handles 'without being'", () => {
    const { included, excluded } = splitExclusions("funny without being childish");
    expect(included).toMatch(/funny/i);
    expect(excluded).toMatch(/childish/i);
  });

  it("returns everything as included when there is no exclusion", () => {
    const { included, excluded } = splitExclusions("something calm for tonight");
    expect(included).toBe("something calm for tonight");
    expect(excluded).toBe("");
  });
});

describe("extractRuntime", () => {
  it.each([
    ["I only have 90 minutes", 90],
    ["a movie for a 2-hour flight", 120],
    ["something under 2 hours", 120],
    ["I have an hour and a half", 90],
    ["give me something short", 100],
  ])("%s -> %i", (text, expected) => {
    expect(extractRuntime(text)).toBe(expected);
  });

  it("returns null when no runtime is stated — never assumes (§21)", () => {
    expect(extractRuntime("something calm and beautiful")).toBeNull();
  });
});

describe("extractAudience", () => {
  it("reads an explicit audience", () => {
    expect(extractAudience("something to watch with friends")).toBe("friends");
    expect(extractAudience("a movie for me and my partner")).toBe("couple");
    expect(extractAudience("something for family night")).toBe("family");
  });

  it("never infers an audience that wasn't stated (§22)", () => {
    expect(extractAudience("something dark and mysterious")).toBeNull();
  });
});

describe("extractRecency / extractSimilarTo", () => {
  it("detects explicit recency intent (§23)", () => {
    expect(extractRecency("something new")).toBe("new");
    expect(extractRecency("give me a classic")).toBe("classic");
    expect(extractRecency("something calm")).toBe("any");
  });

  it("pulls the referenced title out, dropping the qualifier", () => {
    expect(extractSimilarTo("something like Interstellar, but more hopeful")).toBe("Interstellar");
    expect(extractSimilarTo("I want something calm")).toBeNull();
  });
});

describe("parseMoodIntent", () => {
  it("maps 'calm' onto a cluster of real catalog tags, not the near-empty Calm tag alone", () => {
    const intent = parseMoodIntent("I want something calm for tonight", GENRES);
    expect(intent.moods).toContain("Calm");
    expect(intent.moods.length).toBeGreaterThan(1);
    expect(intent.moods).toContain("Atmospheric");
  });

  it("excludes horror for 'dark but not horror' while keeping the dark moods", () => {
    const intent = parseMoodIntent("I want a dark movie but not horror", GENRES);
    expect(intent.moods).toContain("Dark");
    expect(intent.excludeGenres).toContain("Horror");
    expect(intent.genres).not.toContain("Horror");
  });

  it("does not let an exclusion cancel what was explicitly asked for", () => {
    // "emotional" and "depressing" share the Emotion-focused tag; dropping it
    // would gut the request.
    const intent = parseMoodIntent("I want something emotional but not depressing", GENRES);
    expect(intent.moods).toContain("Emotion-focused");
    expect(intent.excludeMoods).not.toContain("Emotion-focused");
  });

  it("applies a concept's own genre veto — calm rules out horror", () => {
    const intent = parseMoodIntent("something calm", GENRES);
    expect(intent.excludeGenres).toContain("Horror");
  });

  it("reads a runtime constraint together with a mood", () => {
    const intent = parseMoodIntent("something funny, I only have 90 minutes", GENRES);
    expect(intent.runtimeMaxMin).toBe(90);
    expect(intent.genres).toContain("Comedy");
  });

  it("respects an explicit content type", () => {
    expect(parseMoodIntent("a dark show", GENRES).contentTypes).toEqual(["tv_show"]);
    expect(parseMoodIntent("a dark movie", GENRES).contentTypes).toEqual(["movie"]);
  });

  it("produces a schema-valid intent for every spec example", () => {
    const examples = [
      "I want something calm for tonight.",
      "I want a dark movie but not horror.",
      "I want something emotional but not depressing.",
      "I want a movie for a rainy night.",
      "I want something like Interstellar, but more hopeful.",
      "I want something to watch with friends.",
      "I only have 90 minutes.",
      "Something atmospheric with a strong soundtrack.",
      "I want to cry, but not completely ruin my night.",
      "Something smart but easy to watch.",
    ];
    for (const example of examples) {
      expect(() => moodIntentSchema.parse(parseMoodIntent(example, GENRES))).not.toThrow();
    }
  });
});

describe("sanitizeIntent", () => {
  it("drops moods and genres the model invented", () => {
    const raw = moodIntentSchema.parse({
      moods: ["Atmospheric", "Vibey", "Chef's Kiss"],
      genres: ["Drama", "Mumblecore"],
      excludeGenres: ["Horror", "Not A Genre"],
    });
    const clean = sanitizeIntent(raw, GENRES);
    expect(clean.moods).toEqual(["Atmospheric"]);
    expect(clean.genres).toEqual(["Drama"]);
    expect(clean.excludeGenres).toEqual(["Horror"]);
  });

  it("canonicalizes genre casing from the model", () => {
    const raw = moodIntentSchema.parse({ genres: ["sci-fi", "DRAMA"] });
    expect(sanitizeIntent(raw, GENRES).genres).toEqual(["Sci-Fi", "Drama"]);
  });
});
