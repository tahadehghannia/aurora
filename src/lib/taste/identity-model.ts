import type { SpectrumKey, TasteSpectrum } from "@/lib/taste/identity-types";

/**
 * Aurora's own entertainment-identity framework. Pure (no server-only import)
 * so the matching logic is directly unit-testable.
 *
 * Design notes, from the research phase:
 *  - An archetype is *nearest match on measured axes*, not a bucket the user is
 *    sorted into. Every identity declares where it sits on each spectrum, and
 *    the user is matched to whichever sits closest to their actual position.
 *    That keeps the result derived rather than decreed, and makes it explainable.
 *  - Summaries are hedged ("tend to", "often") and none of them are purely
 *    flattering. A description that nobody could find unflattering has no
 *    discriminative power, which is precisely what makes horoscopes feel true.
 *  - Nothing here describes a person. These are descriptions of *viewing and
 *    listening behaviour*, deliberately kept inside that boundary.
 */

export interface IdentityArchetype {
  key: string;
  name: string;
  /** One hedged sentence. Never a personality claim. */
  summary: string;
  /** Where this archetype sits on each axis, 0-100. Axes it doesn't care about are omitted. */
  ideal: Partial<Record<SpectrumKey, number>>;
}

export const ARCHETYPES: IdentityArchetype[] = [
  {
    key: "atmospheric-thinker",
    name: "Atmospheric Thinker",
    summary:
      "You tend toward slower, heavier stories — the kind that take their time and sit with you afterwards rather than resolving neatly.",
    ideal: { tone: 75, pace: 80, breadth: 45 },
  },
  {
    key: "genre-wanderer",
    name: "Genre Wanderer",
    summary:
      "You rarely stay in one lane for long. Your library ranges widely, and you seem more drawn to variety than to going deep in any single genre.",
    ideal: { breadth: 85, reach: 60 },
  },
  {
    key: "deep-diver",
    name: "Deep Diver",
    summary:
      "You go far off the beaten path and stay there. Much of what you pick sits well outside the mainstream, and you tend to return to the same territory.",
    ideal: { reach: 85, breadth: 25 },
  },
  {
    key: "comfort-curator",
    name: "Comfort Curator",
    summary:
      "You know what you like and go back to it. Your picks lean familiar and lighter — less about being surprised, more about reliably enjoying the time.",
    ideal: { tone: 25, breadth: 25, reach: 25 },
  },
  {
    key: "cinematic-explorer",
    name: "Cinematic Explorer",
    summary:
      "You gravitate toward immersive, substantial stories, and you're willing to range outside the obvious to find them.",
    ideal: { pace: 70, breadth: 70, reach: 65 },
  },
  {
    key: "momentum-seeker",
    name: "Momentum Seeker",
    summary:
      "You favour pace and energy. What you pick tends to move quickly and land immediately rather than unfold slowly.",
    ideal: { pace: 15, tone: 40 },
  },
  {
    key: "late-night-romantic",
    name: "Late-Night Romantic",
    summary:
      "Your taste leans melancholy and unhurried, but not bleak — you seem to look for feeling rather than tension.",
    ideal: { tone: 60, pace: 75, reach: 55 },
  },
  {
    key: "popular-current",
    name: "In The Current",
    summary:
      "You stay close to what everyone's watching and listening to. Your library tracks the mainstream rather than running against it.",
    ideal: { reach: 12, breadth: 50 },
  },
];

export interface IdentityMatch {
  archetype: IdentityArchetype;
  /** Mean absolute distance across the axes actually measured — lower is closer. */
  distance: number;
  /** Which axes the match was computed from, so the reveal can say what it used. */
  matchedOn: SpectrumKey[];
}

/**
 * Partial-coverage penalty. Without this, an archetype that declares three axes
 * but only has one measured can win on a lucky single-axis near-match, beating
 * an archetype that fits well across all three. That produced genuinely wrong
 * (and non-discriminative) results — two opposite libraries landing on the same
 * identity — so coverage is priced into the score rather than ignored.
 */
function coveragePenalty(matched: number, declared: number): number {
  const missing = 1 - matched / declared;
  // A single-axis match is additionally unreliable regardless of the ratio.
  return missing * 25 + (matched === 1 ? 12 : 0);
}

function scoreArchetypes(spectrums: TasteSpectrum[]): IdentityMatch[] {
  const byKey = new Map(spectrums.map((s) => [s.key, s.position]));

  return ARCHETYPES.flatMap((archetype) => {
    const declared = Object.keys(archetype.ideal) as SpectrumKey[];
    const axes = declared.filter((k) => byKey.has(k));
    if (axes.length === 0) return [];

    const meanDistance =
      axes.reduce((sum, axis) => sum + Math.abs((byKey.get(axis) ?? 0) - (archetype.ideal[axis] ?? 0)), 0) / axes.length;

    return [{ archetype, distance: meanDistance + coveragePenalty(axes.length, declared.length), matchedOn: axes }];
  }).sort((a, b) => a.distance - b.distance);
}

/**
 * Nearest archetype across the axes we actually have evidence for. An archetype
 * is never scored on an axis the user has no data for — that would let an
 * unmeasured dimension decide the result — but partial coverage is penalised so
 * a thinly-evidenced match can't outrank a well-evidenced one.
 */
export function matchIdentity(spectrums: TasteSpectrum[]): IdentityMatch | null {
  if (spectrums.length === 0) return null;
  return scoreArchetypes(spectrums)[0] ?? null;
}

/**
 * How firmly the result should be stated. A match that's barely closer than the
 * runner-up gets hedged harder — the user should never be told Aurora is sure
 * when it isn't.
 */
export function matchConfidence(spectrums: TasteSpectrum[]): "clear" | "emerging" {
  const scored = scoreArchetypes(spectrums);
  if (scored.length < 2) return "emerging";

  // A result resting on a single measured axis is never stated plainly, however
  // large the gap to the runner-up — one dimension isn't a portrait.
  if (scored[0].matchedOn.length < 2) return "emerging";

  return scored[1].distance - scored[0].distance >= 8 && scored[0].distance <= 28 ? "clear" : "emerging";
}
