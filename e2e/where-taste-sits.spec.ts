import { test, expect, type Page } from "@playwright/test";
import { makeTestUser, signUpAndSkipOnboarding, hideDevOverlay } from "./helpers";

/**
 * "Where your taste sits" after the visual redesign.
 *
 * The section's numbers come from the taste model, so these assert the things
 * the redesign is responsible for: the position is readable in words, the
 * artwork is real and links to real content, and the evidence shown on expand
 * is the model's own — not anything generated for the visual.
 */
test.setTimeout(150_000);

async function buildTaste(page: Page) {
  const res = await page.request.get("/api/search?q=the");
  const cards = ((await res.json()).data?.movies ?? []) as { id: string }[];
  for (const card of cards.slice(0, 12)) {
    await page.request.post("/api/ratings", { data: { kind: "movie", contentId: card.id, score: 5 } });
  }
  expect(cards.length).toBeGreaterThan(0);
}

/** The inner section — the identity block wraps it in a <section> of its own. */
function tasteSection(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Where your taste sits" }) })
    .last();
}

test("each axis states its position in words, not by colour or position alone", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2ewts"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);

  const section = tasteSection(page);
  await expect(section).toBeVisible({ timeout: 60_000 });

  // Every axis carries a written reading — the requirement that the visual is
  // never the only way to understand the value.
  const readings = section.getByText(/Leans strongly toward|Leans toward|Balanced between/);
  expect(await readings.count()).toBeGreaterThanOrEqual(2);

  // And an accessible description carrying the same reading plus its evidence.
  const described = section.getByRole("img").first();
  await expect(described).toHaveAttribute(
    "aria-label",
    /(Leans strongly toward|Leans toward|Balanced between)/
  );
});

test("the artwork on an axis is the user's own content and links to it", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2ewtsb"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);

  const section = tasteSection(page);
  await expect(section).toBeVisible({ timeout: 60_000 });

  // Real catalogue links, never decorative imagery.
  const artwork = section.locator('a[href^="/movie/"], a[href^="/show/"], a[href^="/album/"], a[href^="/artist/"]');
  expect(await artwork.count()).toBeGreaterThan(0);
  await expect(artwork.first()).toHaveAttribute("href", /^\/(movie|show|album|artist)\/.+/);
});

test("expanding an axis reveals the model's own evidence", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2ewtsc"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);

  const section = tasteSection(page);
  await expect(section).toBeVisible({ timeout: 60_000 });

  const axis = section.getByRole("button").first();
  await expect(axis).toHaveAttribute("aria-expanded", "false");

  await axis.click();
  await expect(axis).toHaveAttribute("aria-expanded", "true");

  // The sample count is the model's, stated plainly rather than implied.
  await expect(section.getByText(/Measured from \d+ titles? in your library/).first()).toBeVisible();

  await axis.click();
  await expect(axis).toHaveAttribute("aria-expanded", "false");
});

test("it is reachable and operable by keyboard", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2ewtsd"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);

  const section = tasteSection(page);
  await expect(section).toBeVisible({ timeout: 60_000 });

  const axis = section.getByRole("button").first();
  await axis.focus();
  await expect(axis).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(axis).toHaveAttribute("aria-expanded", "true");
});

test("with reduced motion every axis still reads correctly", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();

  await signUpAndSkipOnboarding(page, makeTestUser("e2ewtse"));
  await buildTaste(page);

  await page.goto("/profile");
  await hideDevOverlay(page);

  const section = tasteSection(page);
  await expect(section).toBeVisible({ timeout: 60_000 });
  await expect(section.getByText(/Leans strongly toward|Leans toward|Balanced between/).first()).toBeVisible();
  await expect(section.getByRole("button").first()).toBeVisible();

  await context.close();
});
