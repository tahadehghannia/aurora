import { describe, it, expect } from "vitest";
import { deriveTasteTraits } from "@/lib/recommendations/traits";

describe("deriveTasteTraits", () => {
  it("returns an empty list for genres with no mapped traits", () => {
    expect(deriveTasteTraits(["NotAGenre"])).toEqual([]);
  });

  it("ranks traits by how many selected genres reinforce them", () => {
    // "Sci-Fi" and "Fantasy" both contribute "Cinematic"; only "Sci-Fi" contributes "Speculative".
    const traits = deriveTasteTraits(["Sci-Fi", "Fantasy"]);
    expect(traits[0]).toBe("Cinematic");
  });

  it("respects the limit parameter", () => {
    const traits = deriveTasteTraits(["Sci-Fi", "Drama", "Thriller", "Comedy"], 2);
    expect(traits).toHaveLength(2);
  });

  it("is deterministic for the same input", () => {
    const a = deriveTasteTraits(["Sci-Fi", "Drama", "Jazz"]);
    const b = deriveTasteTraits(["Sci-Fi", "Drama", "Jazz"]);
    expect(a).toEqual(b);
  });
});
