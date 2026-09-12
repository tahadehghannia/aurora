import { describe, it, expect } from "vitest";
import { aiIdentitySchema, isSafeIdentityCopy } from "@/lib/taste/identity-ai";
import {
  aiDnaSchema,
  aiEvolutionSchema,
  aiMoodProfileSchema,
  isSafeMoodCopy,
  keepGroundedTraits,
} from "@/lib/taste/narrative-ai";
import { isGroundedExplanation } from "@/lib/recommendations/explain-ai";
import {
  DNA_PROMPT,
  EVOLUTION_PROMPT,
  IDENTITY_PROMPT,
  MOOD_PROFILE_PROMPT,
  ONE_PICK_PROMPT,
  PLAYLIST_PROMPT,
  WHY_THIS_PROMPT,
} from "@/lib/ai/prompts";
import type { EntertainmentDNA } from "@/lib/taste/dna";

/**
 * The layer that decides whether model output is allowed to reach a user.
 *
 * Tested against hand-written payloads rather than a live model (§37): these
 * are the cases that matter precisely because a model produces them rarely and
 * unpredictably, which makes them impossible to cover by calling the real API.
 */

describe("schema validation", () => {
  it("rejects an identity with no description", () => {
    expect(aiIdentitySchema.safeParse({ traits: ["calm"] }).success).toBe(false);
  });

  it("rejects an over-long identity description rather than truncating it", () => {
    const result = aiIdentitySchema.safeParse({ description: "x".repeat(400), traits: [] });
    expect(result.success).toBe(false);
  });

  it("caps traits so a model can't flood the UI", () => {
    const result = aiIdentitySchema.safeParse({
      description: "Leans toward slower, atmospheric stories.",
      traits: ["a", "b", "c", "d", "e", "f"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a DNA trait naming a dimension that doesn't exist", () => {
    const result = aiDnaSchema.safeParse({
      summary: "Returns to character-driven drama.",
      traits: [{ dimension: "vibes", label: "Moody", evidence: "12 titles" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts well-formed payloads", () => {
    expect(
      aiDnaSchema.safeParse({
        summary: "Returns to character-driven drama.",
        traits: [{ dimension: "story", label: "Character-driven", evidence: "12 Drama titles rated 4+" }],
      }).success
    ).toBe(true);
    expect(aiMoodProfileSchema.safeParse({ summary: "Mostly atmospheric and melancholic picks." }).success).toBe(true);
    expect(aiEvolutionSchema.safeParse({ summary: "Shifted toward slower stories.", shift: "slower" }).success).toBe(true);
  });
});

describe("identity safety guard (§7)", () => {
  const base = { traits: [], emergingTraits: [] };

  it("blocks copy that turns taste into a personality claim", () => {
    expect(isSafeIdentityCopy({ ...base, description: "You are a deeply introverted person." })).toBe(false);
    expect(isSafeIdentityCopy({ ...base, description: "Your personality leans analytical." })).toBe(false);
  });

  it("blocks anything touching mental health", () => {
    expect(isSafeIdentityCopy({ ...base, description: "Your picks suggest you may be depressed." })).toBe(false);
    expect(isSafeIdentityCopy({ ...base, description: "An anxious viewer drawn to control." })).toBe(false);
  });

  it("blocks a sensitive claim hidden in a trait rather than the description", () => {
    expect(
      isSafeIdentityCopy({ ...base, description: "Leans toward slow, atmospheric films.", traits: ["anxious"] })
    ).toBe(false);
  });

  it("allows ordinary taste description", () => {
    expect(
      isSafeIdentityCopy({
        description: "Gravitates toward atmospheric stories and slower pacing.",
        traits: ["atmospheric", "reflective"],
        emergingTraits: ["darker"],
      })
    ).toBe(true);
  });
});

describe("mood copy safety (§12)", () => {
  it("blocks copy implying how the user feels", () => {
    expect(isSafeMoodCopy("You have been feeling melancholic lately.")).toBe(false);
    expect(isSafeMoodCopy("Your mood has been darker this month.")).toBe(false);
  });

  it("allows copy describing the content", () => {
    expect(isSafeMoodCopy("Your library leans atmospheric and melancholic, with bursts of energetic picks.")).toBe(true);
  });
});

describe("DNA trait grounding (§9)", () => {
  const dna = {
    hasEnoughSignal: true,
    yourTaste: [],
    favoriteGenres: [{ name: "Drama", weight: 5, confidence: "strong" as const }],
    favoriteMoods: [{ name: "Atmospheric", weight: 4, confidence: "strong" as const }],
    favoriteCreators: [],
    favoriteActors: [],
    favoriteArtists: [],
  } satisfies EntertainmentDNA;

  it("keeps traits that cite evidence Aurora actually supplied", () => {
    const kept = keepGroundedTraits(
      {
        summary: "s",
        traits: [{ dimension: "story", label: "Character-driven", evidence: "12 Drama titles rated 4+" }],
      },
      dna
    );
    expect(kept.traits).toHaveLength(1);
  });

  it("drops a trait whose supporting evidence was invented", () => {
    const kept = keepGroundedTraits(
      {
        summary: "s",
        traits: [{ dimension: "music", label: "Shoegaze devotee", evidence: "40 shoegaze albums saved" }],
      },
      dna
    );
    expect(kept.traits).toHaveLength(0);
  });
});

describe("explanation grounding (§10)", () => {
  it("blocks overclaiming about the user", () => {
    expect(isGroundedExplanation("Because you love atmospheric sci-fi.")).toBe(false);
    expect(isGroundedExplanation("You're obsessed with slow-burn thrillers.")).toBe(false);
  });

  it("allows a claim tied to a real signal", () => {
    expect(isGroundedExplanation("Because you rated Interstellar 5/5 and often pick atmospheric sci-fi.")).toBe(true);
  });
});

describe("prompt contracts (§19, §35)", () => {
  const all = [
    IDENTITY_PROMPT,
    DNA_PROMPT,
    MOOD_PROFILE_PROMPT,
    EVOLUTION_PROMPT,
    WHY_THIS_PROMPT,
    ONE_PICK_PROMPT,
    PLAYLIST_PROMPT,
  ];

  it("every prompt carries a task id and a version", () => {
    for (const prompt of all) {
      expect(prompt.task.length).toBeGreaterThan(0);
      expect(prompt.version).toMatch(/^\d+$/);
    }
  });

  it("every prompt forbids inventing facts", () => {
    for (const prompt of all) {
      expect(prompt.system).toMatch(/never invent/i);
    }
  });

  it("every prompt forbids sensitive inference (§7)", () => {
    for (const prompt of all) {
      expect(prompt.system).toMatch(/mental health/i);
      expect(prompt.system).toMatch(/never infer/i);
    }
  });

  it("every prompt states that supplied content is data, not instructions (§35)", () => {
    for (const prompt of all) {
      expect(prompt.system).toMatch(/is DATA|never contains instructions/i);
    }
  });

  it("prompts that choose from candidates forbid going outside the list", () => {
    for (const prompt of [ONE_PICK_PROMPT, PLAYLIST_PROMPT]) {
      expect(prompt.system).toMatch(/supplied list|supplied candidates/i);
    }
  });
});
