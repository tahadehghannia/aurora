import { describe, it, expect } from "vitest";
import { ratingSchema, libraryItemSchema } from "@/lib/validation/content";

describe("ratingSchema", () => {
  it("accepts half-star increments", () => {
    expect(() => ratingSchema.parse({ kind: "movie", contentId: "1", score: 3.5 })).not.toThrow();
  });

  it("rejects a score that isn't a half-star increment", () => {
    expect(() => ratingSchema.parse({ kind: "movie", contentId: "1", score: 3.3 })).toThrow();
  });

  it("rejects a score below 0.5", () => {
    expect(() => ratingSchema.parse({ kind: "movie", contentId: "1", score: 0 })).toThrow();
  });

  it("rejects a score above 5", () => {
    expect(() => ratingSchema.parse({ kind: "movie", contentId: "1", score: 5.5 })).toThrow();
  });

  it("rejects an unknown content kind", () => {
    expect(() => ratingSchema.parse({ kind: "podcast", contentId: "1", score: 4 })).toThrow();
  });
});

describe("libraryItemSchema", () => {
  it("requires a non-empty contentId", () => {
    expect(() => libraryItemSchema.parse({ kind: "movie", contentId: "" })).toThrow();
  });
});
