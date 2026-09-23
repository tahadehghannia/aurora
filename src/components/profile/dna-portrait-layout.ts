import type { PortraitLayer } from "@/lib/taste/dna-portrait-types";

/**
 * The composition.
 *
 * Hand-placed rather than generated, and deliberately not a grid (§6): ranks 0-2
 * sit large and near the eye line, the middle band frames them, and the rest
 * recede to the edges. The centre — roughly x 28-72%, y 30-70% — is left empty
 * on purpose, because that is where the identity sits and it has to stay
 * readable (§19).
 *
 * Fixed per rank, so a portrait looks the same every visit. A composition that
 * reshuffles on each render isn't a portrait, it's a screensaver.
 */
export interface Slot {
  /** Percentages of the stage, from its top-left. */
  x: number;
  y: number;
  /** Width and height as percentages of the stage. */
  w: number;
  h: number;
}

/**
 * Both dimensions are explicit rather than derived from the artwork's aspect
 * ratio, and images crop to fill with object-cover.
 *
 * Deriving height from a 2:3 poster ratio made a 14%-wide tile 34% of the
 * stage tall, which pushed the whole bottom row out of frame. Designing the
 * composition in two dimensions means every slot provably fits: each entry
 * below satisfies x + w <= 100 and y + h <= 100.
 *
 * Small overlaps between depth bands are intentional — tiles at different
 * depths crossing each other is what sells the layering.
 */
export const SLOTS: Slot[] = [
  { x: 5, y: 12, w: 21, h: 30 },
  { x: 74, y: 10, w: 21, h: 30 },
  { x: 10, y: 56, w: 15, h: 32 },
  { x: 75, y: 56, w: 20, h: 33 },
  { x: 40, y: 2, w: 20, h: 22 },
  { x: 0, y: 38, w: 12, h: 24 },
  { x: 87, y: 40, w: 12, h: 24 },
  { x: 38, y: 76, w: 20, h: 22 },
  { x: 24, y: 2, w: 13, h: 20 },
  { x: 62, y: 4, w: 13, h: 20 },
  { x: 2, y: 68, w: 10, h: 20 },
  { x: 88, y: 70, w: 10, h: 20 },
];

/**
 * Whether a slot is wider than it is tall once the stage's own 16:10 ratio is
 * applied — those get the cinematic backdrop, the rest get cover art.
 */
export function isLandscapeSlot(slot: Slot): boolean {
  return slot.w * 1.6 >= slot.h;
}

/** Depth treatment per band. Blur and opacity do the receding, not size alone. */
export const LAYER_STYLE: Record<PortraitLayer, { opacity: number; blur: string; z: number; scale: number }> = {
  foreground: { opacity: 1, blur: "0px", z: 30, scale: 1 },
  midground: { opacity: 0.82, blur: "1px", z: 20, scale: 0.96 },
  background: { opacity: 0.55, blur: "2.5px", z: 10, scale: 0.92 },
};

/**
 * Parallax travel in pixels per band (§10).
 *
 * Nearer things move further, which is what sells the depth. The absolute
 * numbers stay tiny — past about 12px it stops reading as depth and starts
 * reading as drift.
 */
export const PARALLAX_DEPTH: Record<PortraitLayer, number> = {
  background: 3,
  midground: 7,
  foreground: 11,
};

/**
 * Film grain as an inline SVG turbulence filter.
 *
 * Inline so it costs no request and can't 404 into a broken overlay, and cheap
 * enough to sit under a CSS animation without touching the network.
 */
export const GRAIN_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.5'/></svg>`
  );
