import { describe, it, expect } from "vitest";
import { selectNextPick, keyOf } from "@/lib/recommendations/one-pick-select";
import type { ContentCard } from "@/types/content";

function makeCard(id: string, genres: string[] = []): ContentCard {
  return {
    id,
    kind: "movie",
    slug: `movie-${id}`,
    title: `Movie ${id}`,
    imageUrl: "https://example.com/p.jpg",
    genres,
    moods: [],
  };
}

describe("selectNextPick", () => {
  it("returns the top-ranked candidate on a first pick", () => {
    const pool = [makeCard("a", ["Sci-Fi"]), makeCard("b", ["Drama"])];
    expect(selectNextPick(pool, [])?.id).toBe("a");
  });

  it("returns null when every candidate has already been shown", () => {
    const pool = [makeCard("a"), makeCard("b")];
    expect(selectNextPick(pool, [keyOf(pool[0]), keyOf(pool[1])])).toBeNull();
  });

  it("never re-offers an already-shown pick", () => {
    const pool = [makeCard("a", ["Sci-Fi"]), makeCard("b", ["Drama"])];
    const next = selectNextPick(pool, [keyOf(pool[0])]);
    expect(next?.id).toBe("b");
  });

  it("prefers a different primary genre over the next-best same-genre candidate", () => {
    // "b" outranks "c", but shares Sci-Fi with the already-shown "a" — so
    // "Try another" should propose the genuinely different "c" instead.
    const pool = [makeCard("a", ["Sci-Fi"]), makeCard("b", ["Sci-Fi"]), makeCard("c", ["Documentary"])];
    const next = selectNextPick(pool, [keyOf(pool[0])]);
    expect(next?.id).toBe("c");
  });

  it("falls back to next-best when every remaining candidate repeats a shown genre", () => {
    const pool = [makeCard("a", ["Sci-Fi"]), makeCard("b", ["Sci-Fi"]), makeCard("c", ["Sci-Fi"])];
    const next = selectNextPick(pool, [keyOf(pool[0])]);
    expect(next?.id).toBe("b");
  });

  it("keeps rotating genres across several 'Try another' presses", () => {
    const pool = [
      makeCard("a", ["Sci-Fi"]),
      makeCard("b", ["Sci-Fi"]),
      makeCard("c", ["Drama"]),
      makeCard("d", ["Documentary"]),
    ];
    const first = selectNextPick(pool, [])!;
    const second = selectNextPick(pool, [keyOf(first)])!;
    const third = selectNextPick(pool, [keyOf(first), keyOf(second)])!;

    const genres = [first, second, third].map((c) => c.genres?.[0]);
    expect(new Set(genres).size).toBe(3);
  });
});
