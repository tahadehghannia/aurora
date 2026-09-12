import { moodRequestSchema, type MoodRequest } from "@/lib/mood/intent";

/**
 * Refinement (§27, §28).
 *
 * A refinement never edits the generated list directly — it produces a new
 * request and the list is rebuilt from it. That keeps one code path: whatever
 * the user nudges, the result still goes through intent -> candidates ->
 * ranking -> curation, so a refined list is as grounded as a fresh one.
 *
 * Tonal nudges are expressed by extending the prompt rather than by poking at
 * the parsed intent, so the stored prompt always reflects what the user
 * actually asked for and the same parser handles it.
 */

export const REFINEMENT_PRESETS = [
  "more_taste",
  "more_unexpected",
  "darker",
  "lighter",
  "more_emotional",
  "less_emotional",
  "shorter",
  "newer",
] as const;

export type RefinementPreset = (typeof REFINEMENT_PRESETS)[number];

export const REFINEMENT_LABELS: Record<RefinementPreset, string> = {
  more_taste: "More like my taste",
  more_unexpected: "More unexpected",
  darker: "Darker",
  lighter: "Lighter",
  more_emotional: "More emotional",
  less_emotional: "Less emotional",
  shorter: "Shorter",
  newer: "Newer",
};

function extend(prompt: string, addition: string): string {
  // Keep the original sentence intact and readable when it is shown back.
  return `${prompt.trim().replace(/[.\s]+$/, "")}, ${addition}`.slice(0, 400);
}

export function applyPreset(request: MoodRequest, preset: RefinementPreset): MoodRequest {
  switch (preset) {
    case "more_taste":
      return { ...request, exploration: "close" };
    case "more_unexpected":
      return { ...request, exploration: "surprise" };
    case "darker":
      return { ...request, prompt: extend(request.prompt, "darker") };
    case "lighter":
      // "light" alone is ambiguous next to "light-hearted"; be explicit.
      return { ...request, prompt: extend(request.prompt, "lighter and more uplifting") };
    case "more_emotional":
      return { ...request, prompt: extend(request.prompt, "more emotional") };
    case "less_emotional":
      // Phrased as an exclusion so the parser's negation handling picks it up.
      return { ...request, prompt: extend(request.prompt, "nothing too emotional") };
    case "shorter": {
      // Step down from whatever ceiling is in play, never below a feature length.
      const current = request.runtimeMaxMin ?? 140;
      return { ...request, runtimeMaxMin: Math.max(80, current - 30) };
    }
    case "newer":
      return { ...request, prompt: extend(request.prompt, "something new") };
  }
}

/** Free-text refinement: "make it more atmospheric", "less depressing" (§28). */
export function applyFreeformRefinement(request: MoodRequest, refinement: string): MoodRequest {
  const cleaned = refinement
    .trim()
    // Strip the conversational wrapper so the parser sees the actual constraint.
    .replace(/^(?:make it|can you make it|i want it|give me|now)\s+/i, "")
    .replace(/[.\s]+$/, "");
  if (!cleaned) return request;
  return { ...request, prompt: extend(request.prompt, cleaned) };
}

export function isRefinementPreset(value: string): value is RefinementPreset {
  return (REFINEMENT_PRESETS as readonly string[]).includes(value);
}

/** Rebuilds a validated request, so a refined one is never trusted unchecked. */
export function normalizeRequest(request: MoodRequest): MoodRequest {
  return moodRequestSchema.parse(request);
}
