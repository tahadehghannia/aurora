import "server-only";
import { z } from "zod";
import { enhance, evidenceBlock } from "@/lib/ai/enhance";
import { DNA_PROMPT, EVOLUTION_PROMPT, MOOD_PROFILE_PROMPT } from "@/lib/ai/prompts";
import type { EntertainmentDNA, WeightedLabel } from "@/lib/taste/dna";
import type { MoodProfile } from "@/lib/taste/mood-profile";
import type { TasteEvolution } from "@/lib/taste/evolution";

/**
 * AI wording for Entertainment DNA, Mood Profile and Taste Evolution
 * (§8, §9, §12, §13).
 *
 * Same contract throughout: Aurora computes the facts, the model writes the
 * sentence. Every number a model is allowed to state is one it was handed, and
 * a trait it can't tie back to supplied evidence is dropped before display —
 * "the AI should not invent evidence" is enforced here, not just requested in
 * the prompt.
 */

// --- Entertainment DNA ------------------------------------------------------

export const DNA_DIMENSIONS = ["story", "mood", "visual", "music", "discovery", "creators"] as const;

export const aiDnaSchema = z.object({
  summary: z.string().trim().min(10).max(300),
  traits: z
    .array(
      z.object({
        dimension: z.enum(DNA_DIMENSIONS),
        label: z.string().trim().min(2).max(40),
        evidence: z.string().trim().min(4).max(200),
      })
    )
    .max(6)
    .default([]),
});

export type AiDna = z.infer<typeof aiDnaSchema>;

function labelLines(values: WeightedLabel[], noun: string): string[] {
  return values.slice(0, 5).map((v) => {
    const count = typeof v.favoriteCount === "number" ? `, ${v.favoriteCount} favourites` : "";
    return `${v.name} (${v.confidence} signal${count}) — ${noun}`;
  });
}

export function buildDnaEvidence(dna: EntertainmentDNA): string {
  return evidenceBlock([
    { label: "Genres they return to", lines: labelLines(dna.favoriteGenres, "genre") },
    { label: "Moods they gravitate toward", lines: labelLines(dna.favoriteMoods, "mood") },
    { label: "Directors and creators", lines: labelLines(dna.favoriteCreators, "creator") },
    { label: "Actors", lines: labelLines(dna.favoriteActors, "actor") },
    { label: "Musical artists", lines: labelLines(dna.favoriteArtists, "artist") },
    { label: "Aurora's own one-line read", lines: dna.yourTaste },
  ]);
}

/**
 * Drops any trait whose evidence doesn't correspond to something Aurora
 * actually supplied. A model that invents a supporting fact loses the trait,
 * not just the sentence.
 */
export function keepGroundedTraits(candidate: AiDna, dna: EntertainmentDNA): AiDna {
  const known = new Set(
    [
      ...dna.favoriteGenres,
      ...dna.favoriteMoods,
      ...dna.favoriteCreators,
      ...dna.favoriteActors,
      ...dna.favoriteArtists,
    ].map((v) => v.name.toLowerCase())
  );

  const traits = candidate.traits.filter((trait) => {
    const haystack = `${trait.label} ${trait.evidence}`.toLowerCase();
    return [...known].some((name) => haystack.includes(name));
  });

  return { ...candidate, traits };
}

export async function generateDnaCopy(userId: string, dna: EntertainmentDNA, options: { force?: boolean } = {}) {
  if (!dna.hasEnoughSignal) return null;

  const result = await enhance({
    userId,
    kind: "DNA",
    prompt: DNA_PROMPT,
    schema: aiDnaSchema,
    // Five traits each carrying an evidence string, on top of reasoning tokens.
    maxTokens: 2400,
    ...(options.force === undefined ? {} : { force: options.force }),
    buildUser: () => buildDnaEvidence(dna),
  });

  if (!result) return null;
  return { ...result, data: keepGroundedTraits(result.data, dna) };
}

// --- Mood Profile -----------------------------------------------------------

export const aiMoodProfileSchema = z.object({
  summary: z.string().trim().min(10).max(260),
});

/**
 * Mood tags describe content. Copy implying they describe the user is rejected (§12).
 *
 * Same split as the identity guard: phrases keep their word boundaries, stems
 * deliberately do not, so "depressed" and "anxiety-inducing" are both caught.
 */
const FEELING_PHRASES = /\b(?:you (?:feel|felt|seem|have been feeling)|your mood|your emotional)\b/i;
const FEELING_STEMS = /emotional state|mental health|depress|anxious|anxiety|lonely|isolat/i;

export function isSafeMoodCopy(summary: string): boolean {
  return !FEELING_PHRASES.test(summary) && !FEELING_STEMS.test(summary);
}

export function buildMoodEvidence(profile: MoodProfile): string {
  return evidenceBlock([
    {
      label: "Moods most present in their library",
      lines: profile.mostEnjoyed.slice(0, 6).map((m) => `${m.mood} (${m.confidence} signal)`),
    },
    { label: "Recently explored", lines: profile.recentlyExplored.slice(0, 4) },
    { label: "Only just appearing", lines: profile.emerging.slice(0, 4) },
    { label: "Muted by the user — never recommend these", lines: profile.mutedMoods },
  ]);
}

export async function generateMoodProfileCopy(
  userId: string,
  profile: MoodProfile,
  options: { force?: boolean } = {}
) {
  if (!profile.hasEnoughSignal) return null;

  const result = await enhance({
    userId,
    kind: "MOOD_PROFILE",
    prompt: MOOD_PROFILE_PROMPT,
    schema: aiMoodProfileSchema,
    ...(options.force === undefined ? {} : { force: options.force }),
    buildUser: () => buildMoodEvidence(profile),
  });

  if (!result || !isSafeMoodCopy(result.data.summary)) return null;
  return result;
}

// --- Taste Evolution --------------------------------------------------------

export const aiEvolutionSchema = z.object({
  summary: z.string().trim().min(10).max(300),
  shift: z.string().trim().max(120).default(""),
});

export function buildEvolutionEvidence(evolution: TasteEvolution): string {
  return evidenceBlock([
    {
      label: "Genres by period, oldest first",
      lines: evolution.periods.map((p) => `${p.label}: ${p.topGenres.join(", ") || "no clear pattern"}`),
    },
  ]);
}

export async function generateEvolutionCopy(
  userId: string,
  evolution: TasteEvolution,
  options: { force?: boolean } = {}
) {
  // Two periods is the minimum at which "change" is even a coherent claim (§13).
  if (!evolution.available || evolution.periods.length < 2) return null;

  return enhance({
    userId,
    kind: "TASTE_EVOLUTION",
    prompt: EVOLUTION_PROMPT,
    schema: aiEvolutionSchema,
    ...(options.force === undefined ? {} : { force: options.force }),
    buildUser: () => buildEvolutionEvidence(evolution),
  });
}
