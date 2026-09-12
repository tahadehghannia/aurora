import "server-only";

/**
 * A small fixed-window limiter for endpoints that are expensive to serve —
 * anything that fans out into a large query or an AI call (§43).
 *
 * Deliberately in-process: Aurora runs as a single Node server, and a shared
 * store would be infrastructure this doesn't yet need. The consequence is
 * real and worth stating — limits are per instance, so a multi-instance
 * deployment needs this moved behind Redis or the platform's own limiter.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Keeps the map from growing without bound on a long-lived process. */
function sweep(now: number): void {
  if (windows.size < 500) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the window resets — surfaced as Retry-After. */
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  existing.count++;
  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfterSec };
}

/** Test seam. */
export function resetRateLimits(): void {
  windows.clear();
}
