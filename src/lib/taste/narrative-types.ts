/**
 * Client-safe narrative shapes.
 *
 * Separate from the `server-only` modules that produce them so client
 * components can type against them without risking a Prisma import in the
 * browser bundle.
 */

export interface TasteNarrative {
  summary: string;
  /** True when a model wrote this. Drives the transparency label (§30). */
  aiGenerated: boolean;
  /** ISO timestamp, present only for generated copy. */
  generatedAt?: string;
}

export interface DnaTrait {
  dimension: "story" | "mood" | "visual" | "music" | "discovery" | "creators";
  label: string;
  /** The countable fact behind it, taken from what Aurora supplied. */
  evidence: string;
}
