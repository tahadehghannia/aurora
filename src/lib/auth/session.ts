import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

/** Returns the current user id, or null if the request is unauthenticated. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * For Server Components under the (app) group: returns the signed-in session,
 * redirecting to /login if there isn't one. The (app) layout already redirects
 * unauthenticated visitors, but React can render a page before that redirect
 * unwinds — every page that needs the session calls this too rather than
 * asserting non-null, so it fails safe instead of throwing.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
