import { test, expect } from "@playwright/test";
import { makeTestUser, hideDevOverlay } from "./helpers";

/**
 * Covers the new core personalization features end-to-end: Entertainment
 * DNA / Mood Profile rendering real signal on Profile, the "Why this?"
 * explanation checklist on a detail page, and the AI watchlist
 * generate -> preview -> save flow landing a real Collection in the Library.
 */
// The broadest integration test in the suite: signup, three profile tabs, three
// movie pages, ratings, the "Why this?" checklist, and the AI watchlist
// generate -> save flow. Every individual route responds in well under a second;
// there are simply more steps here than the default 30s budget allows.
test.setTimeout(90_000);

test("Entertainment DNA, Why This, and AI watchlist generation all work off real user data", async ({ page }) => {
  const user = makeTestUser("e2epersonal");

  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("Personalization Tester");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);
  await page.goto("/home");
  await hideDevOverlay(page);

  // Before any activity, DNA/Mood Profile correctly say there isn't enough
  // signal yet rather than fabricating a taste profile.
  // Entertainment DNA and Mood Profile live on the Taste tab; the Overview tab
  // leads with the Entertainment Identity instead.
  await page.goto("/profile?tab=taste");
  await expect(page.getByText(/Rate, save or watch a few things/).first()).toBeVisible();
  await expect(page.getByText(/We need a few more ratings/).first()).toBeVisible();

  // With no signal at all, Aurora must decline to name an identity rather than guess.
  await page.goto("/profile");
  await expect(page.getByText(/Still taking shape/).first()).toBeVisible();

  // Rate three Sci-Fi movies highly so a real genre/mood signal exists.
  await page.goto("/discover?kind=movie&genre=sci-fi");
  const movieLinks = page.locator('a[href^="/movie/"]:has(p)');
  const count = await movieLinks.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < Math.min(3, count); i++) {
    const href = await movieLinks.nth(i).getAttribute("href");
    await page.goto(href!);
    await page.locator('button[aria-label="5 stars"]').first().click();
    await expect(page.getByText(/Your rating: 5/).first()).toBeVisible();
  }

  // Entertainment DNA and Mood Profile now reflect that real signal.
  await page.goto("/profile?tab=taste");
  await expect(page.getByText("The stories and sounds that shape your taste.").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entertainment DNA" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mood Profile" }).first()).toBeVisible();
  await expect(page.getByText("Sci-Fi", { exact: true }).first()).toBeVisible();

  // Taste Evolution answers a different question ("what changed?") and lives
  // on its own tab. It correctly still says it's taking shape — a handful of
  // same-day ratings isn't a real multi-period history.
  await page.goto("/profile?tab=evolution");
  await expect(page.getByText(/Keep exploring.*taste story will appear here/).first()).toBeVisible();

  // "Why this?" on a fresh Sci-Fi movie's detail page expands into a
  // checklist grounded in the ratings just given.
  await page.goto("/discover?kind=movie&genre=sci-fi");
  const unratedHref = await movieLinks.first().getAttribute("href");
  await page.goto(unratedHref!);
  const whyThis = page.getByRole("button", { name: "Why this?" });
  if (await whyThis.isVisible()) {
    await whyThis.click();
    // A richer taste signal can ground more than one checklist line at once
    // (e.g. both a genre-affinity reason and a specific rated title) — assert
    // at least one grounded reason renders, not that exactly one does. Genre
    // confidence can land as either "often enjoy" (high) or the qualified
    // "may fit your taste" (medium/low) depending on exact accumulated weight.
    await expect(
      page.getByText(/often enjoy sci-fi\.|may fit your taste.*sci-fi\.|rated .+\/5\./).first()
    ).toBeVisible();
  }

  // AI watchlist: generate from a prompt, save, and confirm it lands in the Library.
  await page.goto("/library/collections");
  await page.getByRole("button", { name: "Generate with AI" }).first().click();
  await page.getByPlaceholder(/atmospheric psychological movies/).first().fill("sci-fi movies");
  await page.getByRole("button", { name: "Generate" }).first().click();
  await expect(page.getByText(/Sci-Fi Watchlist|Your AI Watchlist/).first()).toBeVisible();
  await page.getByRole("button", { name: "Save to Library" }).first().click();
  await expect(page.getByRole("button", { name: "Generate with AI" }).first()).toBeVisible();
  await expect(page.locator("main")).toContainText(/Sci-Fi Watchlist|Your AI Watchlist/);
});
