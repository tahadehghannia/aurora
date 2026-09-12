import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/service";
import { isAiConfigured } from "@/lib/ai/provider";
import { PLAYLIST_PROMPT } from "@/lib/ai/prompts";
import type { ContentCard } from "@/types/content";

/**
 * AI curation for playlists (§17).
 *
 * Identical contract to the watchlist path: Aurora retrieves and ranks real
 * tracks from its own catalogue, and the model reorders, titles and explains
 * within that set. Fictional songs are the classic failure of AI playlist
 * features, so an id outside the candidate set invalidates the whole response
 * rather than being quietly dropped.
 */

const playlistSchema = z.object({
  title: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(240),
  items: z
    .array(z.object({ contentId: z.string().min(1), reason: z.string().trim().min(2).max(160) }))
    .min(1)
    .max(30),
});

export interface PlaylistCandidate {
  card: ContentCard;
  /** Aurora's own reason, supplied as evidence the model may draw on. */
  reason: string;
}

export interface CuratedPlaylist {
  title: string;
  description: string;
  items: { contentId: string; reason: string }[];
}

export async function curatePlaylistWithAi(
  prompt: string,
  candidates: PlaylistCandidate[],
  tasteSummary: string[]
): Promise<CuratedPlaylist | null> {
  if (!isAiConfigured() || candidates.length === 0) return null;

  const shortlist = candidates.slice(0, 30);
  const allowed = new Set(shortlist.map((c) => c.card.id));

  const user = [
    `They asked for: "${prompt}"`,
    tasteSummary.length > 0
      ? `What Aurora knows about their listening:\n- ${tasteSummary.join("\n- ")}`
      : "Aurora has little listening history for this person; do not claim to know their taste.",
    "",
    "Tracks to choose from:",
    ...shortlist.map(
      (c) =>
        `id=${c.card.id} title=${c.card.title} artist=${c.card.subtitle ?? "unknown"} genres=${(c.card.genres ?? []).slice(0, 2).join("/") || "-"} moods=${(c.card.moods ?? []).slice(0, 2).join("/") || "-"} auroraEvidence="${c.reason}"`
    ),
  ].join("\n");

  const outcome = await generateStructured({
    task: "playlist",
    promptVersion: PLAYLIST_PROMPT.version,
    system: PLAYLIST_PROMPT.system,
    user,
    schema: playlistSchema,
    maxTokens: 2400,
    timeoutMs: 15_000,
  });

  if (!outcome.ok) return null;

  const seen = new Set<string>();
  const items = outcome.data.items.filter((item) => {
    if (!allowed.has(item.contentId) || seen.has(item.contentId)) return false;
    seen.add(item.contentId);
    return true;
  });

  // Mostly-invented ids mean the response as a whole is untrustworthy, copy
  // included — so the deterministic playlist stands instead.
  if (items.length === 0 || items.length < outcome.data.items.length / 2) return null;

  return { title: outcome.data.title, description: outcome.data.description, items };
}
