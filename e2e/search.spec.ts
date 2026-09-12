import { test, expect } from "@playwright/test";
import { makeTestUser, signUpAndSkipOnboarding } from "./helpers";

test.describe("search", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndSkipOnboarding(page, makeTestUser("e2esearch"));
  });

  test("shows an empty state before typing, then real results across content types", async ({ page }) => {
    await page.goto("/search");

    // .first(): while the dev server is still compiling, React's streamed
    // suspense fallback can briefly leave a hidden second copy of the page in
    // the DOM, and a strict-mode violation throws rather than retrying.
    await expect(page.getByText("Popular right now").first()).toBeVisible();

    await page.locator("main").getByPlaceholder(/Search movies, shows, artists/).fill("Radiohead");

    await expect(page.getByRole("tab", { name: /^All/ }).first()).toBeVisible();
    await expect(page.getByText("Radiohead").first()).toBeVisible();
  });

  test("shows a no-results state for a nonsense query", async ({ page }) => {
    await page.goto("/search");
    await page.locator("main").getByPlaceholder(/Search movies, shows, artists/).fill("zzzznonexistentquery9999");

    await expect(page.getByText(/No results for/).first()).toBeVisible();
  });

  test("records the query in recent searches for next time", async ({ page }) => {
    await page.goto("/search");
    await page.locator("main").getByPlaceholder(/Search movies, shows, artists/).fill("Breaking Bad");

    // Wait for the actual (debounced) search response, not just a suggestion
    // card that happens to share the title — only the real search request
    // records history server-side.
    await expect(page.getByRole("tab", { name: /^All/ }).first()).toBeVisible();
    await expect(page.getByText("Breaking Bad").first()).toBeVisible();

    // Clear and revisit — the recent search chip should now be there.
    await page.goto("/search");
    await expect(page.getByText("Recent searches").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Breaking Bad" }).first()).toBeVisible();
  });
});
