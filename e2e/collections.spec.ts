import { test, expect } from "@playwright/test";
import { makeTestUser, signUpAndSkipOnboarding } from "./helpers";

test.describe("collections", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndSkipOnboarding(page, makeTestUser("e2ecoll"));
  });

  test("creating a collection from a content page adds the item, and it's removable from the collection page", async ({
    page,
  }) => {
    await page.goto("/movie/the-long-orbit");

    await page.getByRole("button", { name: "Add to collection" }).click();
    await expect(page.getByText("You don't have any collections yet")).toBeVisible();

    await page.getByPlaceholder("New collection name").fill("Weekend Watchlist");
    await page.getByRole("button", { name: "Create collection" }).click();

    // The new collection appears, checked, with a count of 1.
    const row = page.locator("label", { hasText: "Weekend Watchlist" });
    await expect(row.getByRole("checkbox")).toBeChecked();

    await page.keyboard.press("Escape");

    // Shows up in the library list.
    await page.goto("/library/collections");
    await expect(page.getByText("Weekend Watchlist")).toBeVisible();
    await expect(page.getByText("1 item")).toBeVisible();

    // Open it, remove the item, confirm the empty state.
    await page.getByText("Weekend Watchlist").click();
    await expect(page).toHaveURL(/\/library\/collections\/.+/);
    await expect(page.getByText("The Long Orbit")).toBeVisible();

    await page.locator('button[aria-label*="Remove"]').first().click();
    await expect(page.getByText("This collection is empty")).toBeVisible();
  });

  test("unchecking a collection in the picker removes the item again", async ({ page }) => {
    await page.goto("/movie/the-long-orbit");
    await page.getByRole("button", { name: "Add to collection" }).click();
    await page.getByPlaceholder("New collection name").fill("Toggle Test");
    await page.getByRole("button", { name: "Create collection" }).click();

    const checkbox = page.locator("label", { hasText: "Toggle Test" }).getByRole("checkbox");
    await expect(checkbox).toBeChecked();

    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
  });
});
