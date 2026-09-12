import { test, expect } from "@playwright/test";
import { makeTestUser, signUpAndSkipOnboarding } from "./helpers";

test.describe("playlists", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndSkipOnboarding(page, makeTestUser("e2epl"));
  });

  test("creating a playlist from a song page, then editing and deleting it from the library", async ({ page }) => {
    // Find a real song via search rather than hard-coding a live-seeded slug.
    await page.goto("/search");
    await page.locator("main").getByPlaceholder(/Search movies, shows, artists/).fill("Let Down");
    const songLink = page.locator('a[href^="/song/"]').first();
    await expect(songLink).toBeVisible();
    await songLink.click();

    await page.getByRole("button", { name: "Add to playlist" }).click();
    await expect(page.getByText("You don't have any playlists yet")).toBeVisible();

    await page.getByPlaceholder("New playlist name").fill("Focus Mix");
    await page.getByRole("button", { name: "Create playlist" }).click();

    const row = page.locator("label", { hasText: "Focus Mix" });
    await expect(row.getByRole("checkbox")).toBeChecked();
    await page.keyboard.press("Escape");

    // Library list shows it.
    await page.goto("/library/playlists");
    await expect(page.getByText("Focus Mix")).toBeVisible();
    await expect(page.getByText("1 track")).toBeVisible();

    // Open, edit title, confirm it sticks.
    await page.getByText("Focus Mix").click();
    await expect(page).toHaveURL(/\/library\/playlists\/.+/);

    await page.getByRole("button", { name: "Edit playlist" }).click();
    const titleInput = page.locator("input").first();
    await titleInput.fill("Deep Focus");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Deep Focus" })).toBeVisible();

    // Remove the track, confirm the empty state.
    await page.locator('button[aria-label*="Remove"]').first().click();
    await expect(page.getByText("No tracks yet")).toBeVisible();

    // Delete the playlist entirely.
    await page.getByRole("button", { name: "Delete playlist" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/library\/playlists$/);
    await expect(page.getByText("No playlists yet")).toBeVisible();
  });
});
