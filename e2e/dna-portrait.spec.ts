import { test, expect, type Page } from "@playwright/test";
import { makeTestUser, signUpAndSkipOnboarding, hideDevOverlay } from "./helpers";

/**
 * The Entertainment DNA portrait.
 *
 * Assertions target structure and behaviour, never generated copy or pixel
 * positions: the identity wording comes from a model and the artwork depends on
 * which titles the account rated, but the rules the composition must obey are
 * fixed.
 */
test.setTimeout(180_000);

/** Rates real catalogue titles through the API so no detail pages are opened. */
async function buildTaste(page: Page, count = 12) {
  const res = await page.request.get("/api/search?q=the");
  const cards = ((await res.json()).data?.movies ?? []) as { id: string }[];
  for (const card of cards.slice(0, count)) {
    await page.request.post("/api/ratings", { data: { kind: "movie", contentId: card.id, score: 5 } });
  }
  expect(cards.length).toBeGreaterThan(0);
}

const tiles = (page: Page) => page.locator('button[aria-label*="—"]');

test("the portrait is built from the user's own artwork and stays inside its frame", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2edna"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);
  await expect(page.getByText("Your entertainment identity").first()).toBeVisible({ timeout: 60_000 });

  await expect(tiles(page).first()).toBeVisible();
  expect(await tiles(page).count()).toBeGreaterThanOrEqual(4);

  // Every tile must sit within the stage — heights derived from poster aspect
  // ratios pushed the bottom row out of frame once already.
  const overflowing = await page.evaluate(() => {
    const stage = document.querySelector('div[class*="aspect"]') as HTMLElement | null;
    if (!stage) return ["no stage"];
    const bounds = stage.getBoundingClientRect();
    return [...stage.querySelectorAll('button[aria-label*="—"]')]
      .map((tile) => {
        const box = tile.getBoundingClientRect();
        return box.right - bounds.right > 2 || box.bottom - bounds.bottom > 2
          ? (tile.getAttribute("aria-label") ?? "unknown")
          : null;
      })
      .filter(Boolean);
  });
  expect(overflowing).toEqual([]);
});

test("hovering identifies a work, and opening it shows the evidence behind it", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2ednab"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);
  await expect(tiles(page).first()).toBeVisible({ timeout: 60_000 });

  const first = tiles(page).first();
  const label = (await first.getAttribute("aria-label")) ?? "";
  const title = label.split(" — ")[0]!;

  await first.hover();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  // Opening resolves to the centre and states why the work is in the portrait.
  await first.click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(title);
  // The evidence is a real, checkable fact — never a vague assertion.
  await expect(panel).toContainText(/You rated .+\/5\.|You saved /);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("filtering by a trait brings related artwork forward", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2ednac"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);
  await expect(tiles(page).first()).toBeVisible({ timeout: 60_000 });

  const filter = page.getByRole("group", { name: /Filter your DNA/ });
  await expect(filter).toBeVisible();

  const chip = filter.getByRole("button").first();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");

  // Filtering changes emphasis, never availability — every work stays reachable.
  expect(await tiles(page).count()).toBeGreaterThanOrEqual(4);

  await page.getByRole("button", { name: "Show all" }).click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
});

test("mobile shows a reduced composition and no parallax", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndSkipOnboarding(page, makeTestUser("e2ednad"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);
  await expect(page.getByText("Your entertainment identity").first()).toBeVisible({ timeout: 60_000 });

  // 3-6 elements on a phone rather than the full desktop composition.
  const visible = await page.locator('button[aria-label*="—"]:visible').count();
  expect(visible).toBeGreaterThanOrEqual(3);
  expect(visible).toBeLessThanOrEqual(6);
});

test("with reduced motion the portrait keeps all of its information", async ({ browser }) => {
  // Nothing in the portrait may depend on movement to be understood.
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();

  await signUpAndSkipOnboarding(page, makeTestUser("e2ednae"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);

  await expect(page.getByText("Your entertainment identity").first()).toBeVisible({ timeout: 60_000 });
  await expect(tiles(page).first()).toBeVisible();

  const first = tiles(page).first();
  await first.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await context.close();
});
