import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db/prisma";

/**
 * Caching and versioning for AI-generated taste artifacts (§22, §23).
 *
 * Opening Profile twenty times must not cost twenty AI calls, so every
 * generated artifact is stored and reused until something real changes. What
 * counts as "real" is a fingerprint of the taste inputs rather than a timer:
 * a user who hasn't rated anything new should keep seeing the same identity,
 * because their taste genuinely hasn't moved.
 */

export type AiArtifactKind = "IDENTITY" | "DNA" | "MOOD_PROFILE" | "TASTE_EVOLUTION";

/** A cached artifact also goes stale on its own, so prompts/models don't drift forever. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Interactions per bucket before the cache invalidates.
 *
 * Regenerating on every single rating would be wasteful and would make the
 * identity feel unstable; waiting for hundreds would make it feel dead. Five is
 * roughly "a session's worth of activity".
 */
const BUCKET = 5;

export interface TasteDataInputs {
  ratings: number;
  saved: number;
  watched: number;
  listened: number;
}

/**
 * Fingerprints the taste inputs an artifact was generated from.
 *
 * Bucketed on purpose: the exact count changes constantly, but the *shape* of
 * someone's taste does not shift meaningfully between rating 31 and 32 things.
 */
export function buildDataVersion(inputs: TasteDataInputs): string {
  const bucket = (n: number) => Math.floor(n / BUCKET);
  return [bucket(inputs.ratings), bucket(inputs.saved), bucket(inputs.watched), bucket(inputs.listened)].join(".");
}

export interface CachedArtifact<T> {
  payload: T;
  modelVersion: string;
  promptVersion: string;
  generatedAt: Date;
}

/**
 * Returns the cached artifact when it is still valid for the current data,
 * prompt version and age — otherwise null, and the caller regenerates.
 *
 * A payload that no longer matches its schema is treated as a miss rather than
 * a crash: a schema can tighten after something was cached, and stale prose is
 * never worth a broken page.
 */
export async function readArtifact<T>(
  userId: string,
  kind: AiArtifactKind,
  schema: z.ZodType<T>,
  expected: { dataVersion: string; promptVersion: string }
): Promise<CachedArtifact<T> | null> {
  const row = await prisma.aiArtifact.findUnique({ where: { userId_kind: { userId, kind } } });
  if (!row) return null;

  if (row.dataVersion !== expected.dataVersion) return null;
  if (row.promptVersion !== expected.promptVersion) return null;
  if (Date.now() - row.generatedAt.getTime() > MAX_AGE_MS) return null;

  const parsed = schema.safeParse(row.payload);
  if (!parsed.success) return null;

  return {
    payload: parsed.data,
    modelVersion: row.modelVersion,
    promptVersion: row.promptVersion,
    generatedAt: row.generatedAt,
  };
}

export async function writeArtifact<T>(
  userId: string,
  kind: AiArtifactKind,
  payload: T,
  meta: { modelVersion: string; promptVersion: string; dataVersion: string }
): Promise<void> {
  const data = {
    payload: payload as never,
    modelVersion: meta.modelVersion,
    promptVersion: meta.promptVersion,
    dataVersion: meta.dataVersion,
    generatedAt: new Date(),
  };
  await prisma.aiArtifact.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind: kind as never, ...data },
    update: data,
  });
}

/** Drops a cached artifact so the next read regenerates it — powers "Regenerate" (§29). */
export async function invalidateArtifact(userId: string, kind: AiArtifactKind): Promise<void> {
  await prisma.aiArtifact.deleteMany({ where: { userId, kind: kind as never } });
}

/** Counts the deliberate signals behind a user's taste, for fingerprinting. */
export async function getTasteDataInputs(userId: string): Promise<TasteDataInputs> {
  const [ratings, saved, watched, listened] = await Promise.all([
    prisma.rating.count({ where: { userId } }),
    prisma.savedItem.count({ where: { userId } }),
    prisma.watchHistory.count({ where: { userId } }),
    prisma.listeningHistory.count({ where: { userId } }),
  ]);
  return { ratings, saved, watched, listened };
}

/**
 * In-flight deduplication (§26).
 *
 * Two components rendering the same profile in one request both ask for the
 * identity; without this they would each fire an AI call before either had
 * written to the cache.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
