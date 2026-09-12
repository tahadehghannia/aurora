import type { Page } from "@playwright/test";

export interface TestUser {
  email: string;
  username: string;
  password: string;
}

export function makeTestUser(prefix: string): TestUser {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  // Usernames only allow lowercase letters, numbers and underscores — strip
  // anything else (e.g. hyphens in the prefix) before appending the stamp.
  // The stamp itself can be up to 16 digits, and the registration form caps
  // usernames at 24 chars — clamp the prefix so any caller's prefix length
  // can never push the result over that limit.
  const usernameSafePrefix = prefix.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 8);
  return {
    email: `${prefix}-${stamp}@example.com`,
    username: `${usernameSafePrefix}${stamp}`,
    password: "Str0ngPassw0rd",
  };
}

/**
 * Hides Next.js's dev-mode-only "Dev Tools" overlay button, which sits in the
 * same bottom-left corner as our sidebar avatar/theme-toggle controls and
 * intercepts clicks there in `next dev` (it doesn't exist in production).
 * Call once per test, before interacting with that corner of the UI.
 */
export async function hideDevOverlay(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

/** Registers a fresh account via the UI and skips onboarding by navigating straight to /home. */
export async function signUpAndSkipOnboarding(page: Page, user: TestUser) {
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("E2E Tester");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();

  // New accounts land on /onboarding; jump straight to /home for tests that
  // don't care about the wizard itself (search/collections/playlists specs).
  await page.waitForURL(/\/onboarding/);
  await page.goto("/home");
}
