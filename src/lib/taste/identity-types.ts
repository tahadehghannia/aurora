import type { IdentityArchetype } from "@/lib/taste/identity-model";

/**
 * Client-safe shapes for the identity system. Kept out of identity.ts and
 * spectrums.ts because those import `server-only` — a client component that
 * imports a *runtime value* from either would pull Prisma into the browser
 * bundle. Types alone would be erased, but `isTakingShape` is a real function,
 * so it lives here.
 */

export type SpectrumKey = "reach" | "breadth" | "tone" | "pace";

export interface TasteSpectrum {
  key: SpectrumKey;
  /** Label for the low (0) end. */
  leftLabel: string;
  /** Label for the high (100) end. */
  rightLabel: string;
  /** 0-100. 50 means genuinely balanced, not "unknown" — see `sampleSize`. */
  position: number;
  /** How many of the user's own items this position was measured from. */
  sampleSize: number;
  /** The countable fact behind the position — never a vague assertion. */
  evidence: string;
}

export interface IdentityEvidence {
  text: string;
  /** Where clicking this receipt leads, when there's somewhere real to go. */
  href?: string;
}

export interface EntertainmentIdentity {
  archetype: IdentityArchetype;
  /** "clear" states it plainly; "emerging" hedges harder in the copy. */
  confidence: "clear" | "emerging";
  /** Countable receipts — the whole point. Never empty when an identity is returned. */
  evidence: IdentityEvidence[];
  spectrums: TasteSpectrum[];
  /** Chips for the identity header — the user's strongest real mood signals. */
  traits: string[];
}

export interface IdentityTakingShape {
  archetype: null;
  /** What the user can do to give Aurora something to work with. */
  nextSteps: string[];
  /** How close they are, so "taking shape" isn't a dead end. */
  signalsSoFar: number;
}

export type IdentityResult = EntertainmentIdentity | IdentityTakingShape;

export function isTakingShape(result: IdentityResult): result is IdentityTakingShape {
  return result.archetype === null;
}
