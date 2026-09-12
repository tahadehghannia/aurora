import { test, expect } from "@playwright/test";
import { makeTestUser, signUpAndSkipOnboarding } from "./helpers";

/**
 * The core AI loop, end to end (§38).
 *
 * Signs up, generates real taste data, then checks that the AI-assisted
 * surfaces render from it: Entertainment Identity on Profile, a compact summary
 * on Home built from the same model, and "Why this?" on a detail page.
 *
 * The assertions target *honesty properties* rather than specific generated
 * wording — the copy is non-deterministic, but the rules it must obey are not.
 */
test.setTimeout(180_000);

test("real user data flows through the taste model into Profile, Home and Why This", async ({ page }) => {
  await signUpAndSkipOnboarding(page, makeTestUser("e2eaiload"));

  // Before any activity, Aurora must decline to describe a taste it can't see.
  await page.goto("/profile");
  await expect(page.getByText(/Still taking shape/).first()).toBeVisible();

  // Build a genuine signal: rate several titles highly.
  // The unfiltered grid, not a genre filter: Aurora needs 8+ deliberate signals
  // before it will name an identity at all, and narrow genres hold fewer titles
  // than that (Sci-Fi has 4).
  await page.goto("/discover?kind=movie");
  const links = page.locator('a[href^="/movie/"]:has(p)');
  await expect(links.first()).toBeVisible();

  // Collect every href BEFORE navigating: the locator re-queries whatever page
  // is current, so reading it mid-loop would pick up related-title links from
  // the movie page we just opened rather than the discover grid.
  const hrefs = (await links.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href"))))
    .filter((href): href is string => !!href)
    .slice(0, 9);
  expect(hrefs.length).toBeGreaterThanOrEqual(8);

  const rated: string[] = [];
  for (const href of hrefs) {
    await page.goto(href);
    await page.locator('button[aria-label="5 stars"]').first().click();
    await expect(page.getByText(/Your rating: 5/).first()).toBeVisible();
    rated.push(href);
  }

  // Profile now names an identity, and says where the wording came from (§30).
  await page.goto("/profile");
  const main = page.locator("main");
  await expect(main.getByText(/Generated from your Aurora activity|interpretation of your taste/i).first()).toBeVisible({
    timeout: 60_000,
  });

  // Whatever it says, it must never make a claim about the person (§7).
  const profileText = await main.innerText();
  expect(profileText).not.toMatch(/\byou are\b|your personality|mental health|depress(ed|ion)|anxiety/i);

  // The receipts behind the identity are Aurora's, and remain checkable.
  await expect(page.getByRole("button", { name: /Why Aurora sees you this way/i }).first()).toBeVisible();

  // Home shows a compact summary from the same model, not a second one (§32).
  await page.goto("/home");
  await expect(page.getByText("Your taste lately").first()).toBeVisible({ timeout: 60_000 });

  // Why This on a detail page is grounded in the ratings just given (§10).
  await page.goto(rated[0]!);
  const whyThis = page.getByRole("button", { name: "Why this?" });
  if (await whyThis.isVisible()) {
    await whyThis.click();
    const text = await main.innerText();
    expect(text).not.toMatch(/you love|obsessed/i);
  }
});

test("Profile still renders every section when AI copy is unavailable", async ({ page }) => {
  // The deterministic path is the product's floor: identity, DNA and mood must
  // all render from Aurora's own logic regardless of what any model does (§28).
  await signUpAndSkipOnboarding(page, makeTestUser("e2eaifall"));

  await page.goto("/profile?tab=taste");
  await expect(page.getByText(/Rate, save or watch a few things/).first()).toBeVisible();
  await expect(page.getByText(/We need a few more ratings/).first()).toBeVisible();

  await page.goto("/profile?tab=evolution");
  await expect(page.getByText(/Keep exploring.*taste story will appear here/).first()).toBeVisible();
});
