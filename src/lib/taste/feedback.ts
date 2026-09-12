import "server-only";
import { prisma } from "@/lib/db/prisma";
import { CONTENT_TYPE_MAP, type ContentKind } from "@/types/content";

/** Which surface the correction came from — kept on every feedback row so "why is this muted?" is answerable. */
export type FeedbackSource = "why-this" | "mood-profile" | "one-pick" | "settings" | "detail";

export interface FeedbackResult {
  /** Pass back to undoFeedback() to reverse this exact correction. */
  feedbackId: string;
  message: string;
}

async function ensurePreference(userId: string) {
  return prisma.userPreference.upsert({ where: { userId }, update: {}, create: { userId } });
}

function without(list: string[], value: string): string[] {
  return list.filter((v) => v !== value);
}

function withValue(list: string[], value: string): string[] {
  return list.includes(value) ? list : [...list, value];
}

async function logFeedback(input: {
  userId: string;
  feedbackType: "LIKE" | "DISLIKE" | "MORE_LIKE_THIS" | "LESS_LIKE_THIS" | "NOT_FOR_ME" | "HIDE_CREATOR" | "MUTE_GENRE" | "MUTE_MOOD" | "USEFUL";
  source: FeedbackSource;
  kind?: ContentKind;
  contentId?: string;
  targetLabel?: string;
}): Promise<string> {
  const row = await prisma.userFeedback.create({
    data: {
      userId: input.userId,
      feedbackType: input.feedbackType,
      source: input.source,
      contentType: input.kind ? (CONTENT_TYPE_MAP[input.kind] as never) : null,
      contentId: input.contentId ?? null,
      targetLabel: input.targetLabel ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

// ---------------------------------------------------------------------------
// Item-scoped corrections
// ---------------------------------------------------------------------------

/**
 * "Not for me" — the strong exclusion. The item is filtered out of candidate
 * pools entirely (via `seen` in signals.ts), so it stops appearing.
 */
export async function recordNotForMe(
  userId: string,
  kind: ContentKind,
  contentId: string,
  source: FeedbackSource = "why-this"
): Promise<FeedbackResult> {
  await prisma.userContentInteraction.create({
    data: { userId, contentType: CONTENT_TYPE_MAP[kind] as never, contentId, interactionType: "DISMISS", weight: 1 },
  });
  const feedbackId = await logFeedback({ userId, feedbackType: "NOT_FOR_ME", source, kind, contentId });
  return { feedbackId, message: "Got it — we won't show you that again." };
}

/**
 * "Less like this" — deliberately *softer* than "Not for me": the item's own
 * genres/moods take a negative weight in the taste signal (so similar content
 * ranks lower), but nothing is hard-blocked. Per the product rule: don't
 * permanently exclude related content unless the user explicitly asks for the
 * stronger action.
 */
export async function recordLessLikeThis(
  userId: string,
  kind: ContentKind,
  contentId: string,
  source: FeedbackSource = "why-this"
): Promise<FeedbackResult> {
  const feedbackId = await logFeedback({ userId, feedbackType: "LESS_LIKE_THIS", source, kind, contentId });
  return { feedbackId, message: "Thanks — we'll show you fewer like this." };
}

/** "This was useful" / "More like this" on an item — a positive nudge folded into the taste signal. */
export async function recordUseful(
  userId: string,
  kind: ContentKind,
  contentId: string,
  source: FeedbackSource = "why-this"
): Promise<FeedbackResult> {
  await prisma.userContentInteraction.create({
    data: { userId, contentType: CONTENT_TYPE_MAP[kind] as never, contentId, interactionType: "CLICK", weight: 1 },
  });
  const feedbackId = await logFeedback({ userId, feedbackType: "USEFUL", source, kind, contentId });
  return { feedbackId, message: "Thanks — we'll show you more like this." };
}

// ---------------------------------------------------------------------------
// Label-scoped corrections (mood / genre / creator)
// ---------------------------------------------------------------------------

/** "More like this" / "Less like this" on a mood, from the Mood Profile. */
export async function applyMoodFeedback(
  userId: string,
  mood: string,
  action: "more" | "less",
  source: FeedbackSource = "mood-profile"
): Promise<FeedbackResult> {
  const pref = await ensurePreference(userId);
  if (action === "more") {
    await prisma.userPreference.update({
      where: { userId },
      data: { boostedMoods: withValue(pref.boostedMoods, mood), mutedMoods: without(pref.mutedMoods, mood) },
    });
    const feedbackId = await logFeedback({ userId, feedbackType: "MORE_LIKE_THIS", source, targetLabel: mood });
    return { feedbackId, message: `We'll lean into ${mood.toLowerCase()} more.` };
  }

  await prisma.userPreference.update({
    where: { userId },
    data: { mutedMoods: withValue(pref.mutedMoods, mood), boostedMoods: without(pref.boostedMoods, mood) },
  });
  const feedbackId = await logFeedback({ userId, feedbackType: "MUTE_MOOD", source, targetLabel: mood });
  return { feedbackId, message: `Toned down ${mood.toLowerCase()} recommendations.` };
}

/** "Mute this genre" / un-mute. */
export async function setGenreMuted(
  userId: string,
  genre: string,
  muted: boolean,
  source: FeedbackSource = "settings"
): Promise<FeedbackResult> {
  const pref = await ensurePreference(userId);
  await prisma.userPreference.update({
    where: { userId },
    data: { mutedGenres: muted ? withValue(pref.mutedGenres, genre) : without(pref.mutedGenres, genre) },
  });
  const feedbackId = muted ? await logFeedback({ userId, feedbackType: "MUTE_GENRE", source, targetLabel: genre }) : "";
  return { feedbackId, message: muted ? `We'll show you less ${genre.toLowerCase()}.` : `${genre} is back in your recommendations.` };
}

/** Direct add/remove on the muted-moods list — used by Settings to clear an override; the nuanced "more/less" verbs live in applyMoodFeedback above. */
export async function setMoodMuted(userId: string, mood: string, muted: boolean) {
  const pref = await ensurePreference(userId);
  await prisma.userPreference.update({
    where: { userId },
    data: { mutedMoods: muted ? withValue(pref.mutedMoods, mood) : without(pref.mutedMoods, mood) },
  });
}

/** "Hide this creator" — a director name or an artist id, tagged so the two can't collide. */
export async function setCreatorMuted(
  userId: string,
  creatorKey: string,
  muted: boolean,
  source: FeedbackSource = "why-this"
): Promise<FeedbackResult> {
  const pref = await ensurePreference(userId);
  await prisma.userPreference.update({
    where: { userId },
    data: { mutedCreators: muted ? withValue(pref.mutedCreators, creatorKey) : without(pref.mutedCreators, creatorKey) },
  });
  const label = creatorKey.replace(/^(director|artist):/, "");
  const feedbackId = muted ? await logFeedback({ userId, feedbackType: "HIDE_CREATOR", source, targetLabel: creatorKey }) : "";
  return { feedbackId, message: muted ? `We'll stop suggesting ${label}.` : `${label} is back in your recommendations.` };
}

// ---------------------------------------------------------------------------
// Reversibility
// ---------------------------------------------------------------------------

/**
 * Undoes one correction: reverses whatever derived state it created, then
 * marks the log row `undoneAt` (rather than deleting it, so the history stays
 * honest). Safe to call twice — an already-undone row is a no-op.
 */
export async function undoFeedback(userId: string, feedbackId: string): Promise<boolean> {
  const row = await prisma.userFeedback.findFirst({ where: { id: feedbackId, userId, undoneAt: null } });
  if (!row) return false;

  const pref = await ensurePreference(userId);

  switch (row.feedbackType) {
    case "NOT_FOR_ME":
      if (row.contentType && row.contentId) {
        await prisma.userContentInteraction.deleteMany({
          where: { userId, contentType: row.contentType, contentId: row.contentId, interactionType: "DISMISS" },
        });
      }
      break;
    case "USEFUL":
      if (row.contentType && row.contentId) {
        await prisma.userContentInteraction.deleteMany({
          where: { userId, contentType: row.contentType, contentId: row.contentId, interactionType: "CLICK" },
        });
      }
      break;
    case "MUTE_MOOD":
      if (row.targetLabel) {
        await prisma.userPreference.update({ where: { userId }, data: { mutedMoods: without(pref.mutedMoods, row.targetLabel) } });
      }
      break;
    case "MORE_LIKE_THIS":
      if (row.targetLabel) {
        await prisma.userPreference.update({ where: { userId }, data: { boostedMoods: without(pref.boostedMoods, row.targetLabel) } });
      }
      break;
    case "MUTE_GENRE":
      if (row.targetLabel) {
        await prisma.userPreference.update({ where: { userId }, data: { mutedGenres: without(pref.mutedGenres, row.targetLabel) } });
      }
      break;
    case "HIDE_CREATOR":
      if (row.targetLabel) {
        await prisma.userPreference.update({ where: { userId }, data: { mutedCreators: without(pref.mutedCreators, row.targetLabel) } });
      }
      break;
    // LESS_LIKE_THIS has no derived state of its own — the signal engine reads
    // the live feedback rows directly, so marking it undone is the reversal.
    default:
      break;
  }

  await prisma.userFeedback.update({ where: { id: feedbackId }, data: { undoneAt: new Date() } });
  return true;
}

/** Clears explicit overrides only — the user's actual rating/watch/save history is never touched. */
export async function resetPersonalizationOverrides(userId: string) {
  await ensurePreference(userId);
  await prisma.userPreference.update({
    where: { userId },
    data: { mutedGenres: [], mutedMoods: [], boostedMoods: [], mutedCreators: [] },
  });
  await prisma.userFeedback.updateMany({
    where: { userId, undoneAt: null, feedbackType: { in: ["MUTE_GENRE", "MUTE_MOOD", "HIDE_CREATOR", "MORE_LIKE_THIS", "LESS_LIKE_THIS"] } },
    data: { undoneAt: new Date() },
  });
}

/** Recent corrections, newest first — powers the "what have I told Aurora?" list in Settings. */
export async function getRecentFeedback(userId: string, limit = 20) {
  return prisma.userFeedback.findMany({
    where: { userId, undoneAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
