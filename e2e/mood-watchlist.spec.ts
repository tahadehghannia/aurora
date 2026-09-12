import { test, expect } from "@playwright/test";
import { makeTestUser, signUpAndSkipOnboarding } from "./helpers";

/**
 * End-to-end coverage for AI Mood Watchlists: a natural-language request turns
 * into a real, explained, editable list that persists.
 *
 * The suite deliberately exercises the no-AI-provider path as well, because
 * that is the path Aurora must remain fully usable on (§41).
 */

// Signup, rating three titles, then generate -> refine -> replace -> save ->
// reopen. Many steps, each fast; the default 30s budget is about step count.
test.setTimeout(90_000);

test("a natural-language mood request produces a real, explained, savable watchlist", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2emood"));

  // Give Aurora a real taste signal so personalization has something to work with.
  await page.goto("/discover?kind=movie&genre=sci-fi");
  const movieLinks = page.locator('a[href^="/movie/"]:has(p)');
  await expect(movieLinks.first()).toBeVisible();

  const count = Math.min(3, await movieLinks.count());
  for (let i = 0; i < count; i++) {
    const href = await movieLinks.nth(i).getAttribute("href");
    await page.goto(href!);
    await page.locator('button[aria-label="5 stars"]').first().click();
    await expect(page.getByText(/Your rating: 5/).first()).toBeVisible();
  }

  await page.goto("/mood");
  await expect(page.getByRole("heading", { name: "Create with AI" })).toBeVisible();

  // The request is free text, not a fixed taxonomy (§4).
  await page.getByLabel("What are you in the mood for?").fill("Something calm and atmospheric, but not horror");
  await page.getByRole("button", { name: "Build my watchlist" }).click();

  // A real list, with a real title and a list-level explanation (§13, §17).
  const list = page.getByRole("list", { name: "Your watchlist" });
  await expect(list).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Why Aurora made this for you")).toBeVisible();

  const items = list.locator("li");
  await expect(items.first()).toBeVisible();
  const initialCount = await items.count();
  expect(initialCount).toBeGreaterThan(0);

  // Every item links to a real Aurora content page — nothing invented (§8).
  const firstLink = items.first().locator('a[href^="/movie/"], a[href^="/show/"]').first();
  await expect(firstLink).toHaveAttribute("href", /^\/(movie|show)\/.+/);

  // Provenance is stated honestly rather than implying AI did the work (§34).
  await expect(page.getByText(/picked from \d+ candidates/)).toBeVisible();

  // Removing an item is immediate and local to the preview (§30).
  const firstTitle = await items.first().locator("p").first().innerText();
  await items.first().getByRole("button", { name: /^Remove / }).click();
  await expect(list.locator("li")).toHaveCount(initialCount - 1);

  // Save persists it and lands on the saved list (§25).
  await page.getByRole("button", { name: "Save watchlist" }).click();
  await page.waitForURL(/\/mood\/[a-z0-9]+/i);
  await expect(page.getByText("Why Aurora made this for you")).toBeVisible();
  // The removed title did not get saved.
  await expect(page.locator("main")).not.toContainText(firstTitle);

  // It shows up as a real saved artefact.
  await page.goto("/mood");
  await expect(page.getByText("Your recent watchlists")).toBeVisible();
});

test("exclusions in the request are honoured", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2emoodx"));

  await page.goto("/mood");
  await page.getByLabel("What are you in the mood for?").fill("Something dark and tense, but not horror");
  await page.getByRole("button", { name: "Build my watchlist" }).click();

  const list = page.getByRole("list", { name: "Your watchlist" });
  await expect(list).toBeVisible({ timeout: 30_000 });

  // The exclusion is applied as a hard filter, so no item may carry the genre.
  await expect(list).not.toContainText("Horror");
});

test("a brand-new user is told personalization is still forming rather than being flattered", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2emoodn"));

  await page.goto("/mood");
  await page.getByLabel("What are you in the mood for?").fill("Something funny and easy to watch");
  await page.getByRole("button", { name: "Build my watchlist" }).click();

  await expect(page.getByRole("list", { name: "Your watchlist" })).toBeVisible({ timeout: 30_000 });
  // With no history, Aurora must not claim to know their taste (§40).
  await expect(page.getByText(/still learning your taste/i)).toBeVisible();
});

test("the Home and Discover entry points lead into the mood creator", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2emoode"));

  await page.goto("/home");
  await expect(page.getByRole("link", { name: /What are you in the mood for/ }).first()).toBeVisible();

  // Discover carries the active filter into the request (§39).
  await page.goto("/discover?mood=Atmospheric");
  const contextual = page.getByRole("link", { name: /Build a atmospheric watchlist for me/i }).first();
  await expect(contextual).toBeVisible();
  await contextual.click();
  await page.waitForURL(/\/mood\?q=/);
  await expect(page.getByLabel("What are you in the mood for?")).toHaveValue(/atmospheric/i);
});
