import type { TasteSpectrum } from "@/lib/taste/identity-types";

/**
 * The pure parts of "Where your taste sits": how a position becomes words, and
 * how artwork is laid out along an axis.
 *
 * Kept out of the client component so both can be tested directly. Neither
 * computes taste — they only present a position the taste model already
 * produced.
 */

/** How far from centre counts as a real lean, in position points. */
export const STRONG_LEAN = 25;
export const SLIGHT_LEAN = 12;

/** Horizontal gap between frames in a cluster, in axis percent. */
export const FRAME_SPREAD = 7;
/** Keeps the outermost frame clear of the axis edge. */
export const EDGE_PADDING = 7;

export interface Lean {
  label: string;
  strength: string;
  /** null when the axis is genuinely balanced — neither pole is emphasised. */
  leansRight: boolean | null;
}

/**
 * Words for a position.
 *
 * Presentation of an existing number, not a new judgement — and deliberately
 * willing to say "balanced", because forcing every axis to have a winner would
 * overstate what the measurement supports.
 */
export function describeLean(spectrum: Pick<TasteSpectrum, "position" | "leftLabel" | "rightLabel">): Lean {
  const distance = Math.abs(spectrum.position - 50);
  const leansRight = spectrum.position > 50;
  const pole = leansRight ? spectrum.rightLabel : spectrum.leftLabel;

  if (distance < SLIGHT_LEAN) {
    return {
      label: `${spectrum.leftLabel} and ${spectrum.rightLabel}`,
      strength: "Balanced between",
      leansRight: null,
    };
  }

  return {
    label: pole,
    strength: distance >= STRONG_LEAN ? "Leans strongly toward" : "Leans toward",
    leansRight,
  };
}

/**
 * Spreads artwork into an overlapping cluster around the marker, like frames on
 * a contact sheet.
 *
 * The *centre* is what gets clamped, not each frame. Clamping frames
 * individually collapsed the whole cluster onto a single point whenever the
 * marker sat near an extreme — which is exactly where the strongest leans live,
 * so the most emphatic axes were the ones that lost their artwork.
 */
export function clusterOffset(index: number, count: number, position: number): number {
  const halfWidth = ((count - 1) / 2) * FRAME_SPREAD;
  const minCentre = halfWidth + EDGE_PADDING;
  const maxCentre = 100 - halfWidth - EDGE_PADDING;
  const centre = Math.min(maxCentre, Math.max(minCentre, position));
  return centre + (index - (count - 1) / 2) * FRAME_SPREAD;
}

/** Everything the visual conveys, in words, for screen readers. */
export function spokenPosition(spectrum: TasteSpectrum): string {
  const lean = describeLean(spectrum);
  const reading =
    lean.leansRight === null
      ? `Balanced between ${spectrum.leftLabel} and ${spectrum.rightLabel}.`
      : `${lean.strength} ${lean.label}.`;
  return `${spectrum.leftLabel} to ${spectrum.rightLabel}. ${reading} ${spectrum.evidence}`;
}
