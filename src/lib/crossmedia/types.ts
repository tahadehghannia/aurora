import type { ContentCard } from "@/types/content";

/**
 * DIRECT_RELATIONSHIP requires real schema-backed ground truth (e.g. an
 * album actually belongs to an artist) — never inferred from mood/genre
 * overlap. TASTE_BASED and MOOD_BASED are both inferred, and are always
 * labeled as such rather than presented as a factual connection. See
 * discovery.ts for which kind-pairs can ever produce DIRECT_RELATIONSHIP.
 */
export type RelationshipType = "DIRECT_RELATIONSHIP" | "TASTE_BASED" | "MOOD_BASED" | "COMMUNITY_BASED";

export interface CrossMediaConnection {
  card: ContentCard;
  relationshipType: RelationshipType;
  /** Short category label for the UI — "By this artist", "Same mood", "Matches your taste". */
  connectionLabel: string;
  /** Human-readable, grounded explanation — never "AI Score: 97%". */
  reason: string;
}

export interface CrossMediaResult {
  sourceTitle: string;
  connections: CrossMediaConnection[];
}
