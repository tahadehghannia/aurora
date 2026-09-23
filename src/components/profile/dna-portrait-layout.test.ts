import { describe, it, expect } from "vitest";
import { SLOTS, LAYER_STYLE, PARALLAX_DEPTH, isLandscapeSlot } from "@/components/profile/dna-portrait-layout";

/**
 * Composition invariants.
 *
 * The slot table is hand-placed, so it's exactly the kind of data that drifts
 * when someone nudges a number. These lock in the properties that make the
 * portrait work — and one of them (tiles fitting the frame) is a bug that
 * already shipped once, when heights were derived from poster aspect ratios.
 */

/** The identity sits here and must stay readable (§19). */
const CENTER = { x1: 26, y1: 28, x2: 74, y2: 72 };

describe("portrait slots", () => {
  it("covers every rank the portrait can produce", () => {
    expect(SLOTS).toHaveLength(12);
  });

  it("keeps every tile inside the stage", () => {
    for (const [index, slot] of SLOTS.entries()) {
      expect(slot.x, `slot ${index} x`).toBeGreaterThanOrEqual(0);
      expect(slot.y, `slot ${index} y`).toBeGreaterThanOrEqual(0);
      expect(slot.x + slot.w, `slot ${index} right edge`).toBeLessThanOrEqual(100);
      expect(slot.y + slot.h, `slot ${index} bottom edge`).toBeLessThanOrEqual(100);
    }
  });

  it("leaves the centre clear so the identity stays readable", () => {
    for (const [index, slot] of SLOTS.entries()) {
      const overlapsX = slot.x < CENTER.x2 && slot.x + slot.w > CENTER.x1;
      const overlapsY = slot.y < CENTER.y2 && slot.y + slot.h > CENTER.y1;
      expect(overlapsX && overlapsY, `slot ${index} intrudes on the identity`).toBe(false);
    }
  });

  it("gives earlier ranks more visual weight than later ones", () => {
    const area = (i: number) => SLOTS[i]!.w * SLOTS[i]!.h;
    // The three foreground slots should each outweigh the smallest background.
    const smallestBackground = Math.min(...[8, 9, 10, 11].map(area));
    for (const rank of [0, 1, 2]) {
      expect(area(rank)).toBeGreaterThan(smallestBackground);
    }
  });
});

describe("depth treatment", () => {
  it("recedes each band in both opacity and parallax travel", () => {
    expect(LAYER_STYLE.foreground.opacity).toBeGreaterThan(LAYER_STYLE.midground.opacity);
    expect(LAYER_STYLE.midground.opacity).toBeGreaterThan(LAYER_STYLE.background.opacity);
    // Nearer things travel further — that's what reads as depth.
    expect(PARALLAX_DEPTH.foreground).toBeGreaterThan(PARALLAX_DEPTH.midground);
    expect(PARALLAX_DEPTH.midground).toBeGreaterThan(PARALLAX_DEPTH.background);
  });

  it("keeps parallax travel within the subtle range the design calls for (§10)", () => {
    for (const depth of Object.values(PARALLAX_DEPTH)) {
      expect(depth).toBeGreaterThan(0);
      expect(depth).toBeLessThanOrEqual(12);
    }
  });
});

describe("isLandscapeSlot", () => {
  it("routes wide slots to the backdrop and tall slots to the poster", () => {
    expect(isLandscapeSlot({ x: 0, y: 0, w: 21, h: 30 })).toBe(true);
    expect(isLandscapeSlot({ x: 0, y: 0, w: 10, h: 40 })).toBe(false);
  });
});
