import type { PersonalizationLevel } from "@/lib/mood/compose";
import type { MoodIntent, MoodRequest } from "@/lib/mood/intent";
import type { MoodReasonType } from "@/lib/mood/rank";
import type { ContentCard } from "@/types/content";

/**
 * The shapes the browser sees.
 *
 * Kept out of generate.ts deliberately: that module is `server-only`, and a
 * client component importing anything from it — even a type — is one careless
 * edit away from pulling Prisma into the browser bundle.
 */

export interface MoodWatchlistItem {
  card: ContentCard;
  reason: string;
  reasonType: MoodReasonType;
  /** Null means unknown, and is rendered as unknown — never as a guess (§21). */
  runtimeMin: number | null;
  year: number;
}

export interface GeneratedMoodWatchlist {
  title: string;
  description: string;
  whyThisList: string;
  personalization: PersonalizationLevel;
  intent: MoodIntent;
  exploration: MoodRequest["exploration"];
  prompt: string;
  items: MoodWatchlistItem[];
  /** Honest provenance: what the AI actually did, and why it didn't when it didn't. */
  ai: { interpreted: boolean; curated: boolean; configured: boolean; note: string | null };
  /** True when there isn't enough history to claim personalization (§40). */
  insufficientData: boolean;
  /** How many real candidates the list was chosen from — shown as provenance. */
  poolSize: number;
}
