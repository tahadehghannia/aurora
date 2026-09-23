import type { ContentKind } from "@/types/content";

/**
 * Client-safe shapes for the Entertainment DNA portrait.
 *
 * Separate from the server module that builds them, so the animated client
 * component can type against these without risking a Prisma import in the
 * browser bundle.
 */

/** Depth band. Foreground carries the strongest taste signals (§7). */
export type PortraitLayer = "foreground" | "midground" | "background";

/**
 * Which single motion an item gets.
 *
 * One per item, never combined: the brief is a cinemagraph — most of the frame
 * still, one thing alive (§4). Stacking motions is what makes a composition
 * look like a screensaver.
 */
export type PortraitMotion = "zoom" | "drift" | "shimmer" | "still";

export interface PortraitItem {
  /** Stable composite key — content ids are only unique within a kind. */
  id: string;
  contentId: string;
  kind: ContentKind;
  slug: string;
  href: string;
  title: string;
  subtitle: string | null;
  /** Poster or cover art. Always present. */
  imageUrl: string;
  /** Wide backdrop where the medium has one; preferred for large tiles. */
  backdropUrl: string | null;
  /** DNA traits this artwork contributes to (§18). */
  traits: string[];
  /** 0 is the strongest signal. Drives layer, size and motion. */
  rank: number;
  layer: PortraitLayer;
  motion: PortraitMotion;
  /** Why this artwork earned a place — real evidence, never decoration (§17). */
  reason: string;
}

export interface PortraitTrait {
  key: string;
  label: string;
  /** How many items carry it — orders the filter and justifies showing it. */
  count: number;
}

export interface DnaPortrait {
  identityName: string | null;
  identityDescription: string | null;
  identityTraits: string[];
  items: PortraitItem[];
  traits: PortraitTrait[];
  hasEnoughSignal: boolean;
  signalsSoFar: number;
  /**
   * Deliberately empty positions when the portrait is still forming (§35).
   * Showing the gaps is more honest than padding with popular content.
   */
  openSlots: number;
}

export function traitKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
