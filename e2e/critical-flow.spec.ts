import { test, expect } from "@playwright/test";

/**
 * The critical end-to-end flow from the product spec:
 * sign up -> onboarding -> taste selection -> home -> recommendation ->
 * content detail -> save -> rate -> library.
 */
test("new user can sign up, onboard, and build a library", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const username = `e2euser${stamp}`;

  // --- Sign up ---
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("E2E Tester");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Str0ngPassw0rd");
  await page.getByRole("button", { name: "Create account" }).click();

  // --- Onboarding ---
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: "Get started" }).click();

  await page.getByRole("button", { name: "Movies" }).click();
  await page.getByRole("button", { name: "TV Shows" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Sci-Fi", exact: true }).click();
  await page.getByRole("button", { name: "Drama", exact: true }).click();
  await page.getByRole("button", { name: "Thriller", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Favorites step — pick the first available poster.
  const firstFavorite = page.locator("main button").first();
  await firstFavorite.click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Atmospheric", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Generate my taste profile" }).click();

  // --- Home ---
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();

  // --- Content detail ---
  // Scope to actual content cards (they have a title <p>) rather than the hero's "More info" link.
  const firstCard = page.locator('a[href^="/movie/"]:has(p), a[href^="/show/"]:has(p)').first();
  const href = await firstCard.getAttribute("href");
  const title = await firstCard.locator("p").first().textContent();
  await firstCard.click();
  await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  // --- Save ---
  await page.getByRole("button", { name: /^Save$/ }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

  // --- Rate ---
  await page.locator('button[aria-label="5 stars"]').first().click();
  await expect(page.getByText(/Your rating: 5/)).toBeVisible();

  // --- Library reflects both ---
  await page.goto("/library");
  if (title) {
    await expect(page.locator("main")).toContainText(title);
  }

  await page.getByRole("link", { name: "Ratings" }).click();
  await expect(page).toHaveURL(/\/library\/ratings/);
  await expect(page.locator("main")).not.toContainText("No ratings yet");
});
