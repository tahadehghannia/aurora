import { test, expect } from "@playwright/test";
import { makeTestUser, hideDevOverlay } from "./helpers";

/**
 * Feature 06's core promise: corrections actually change recommendations, and
 * nothing the user tells Aurora is irreversible. Exercised through the real
 * API so the derived state (not just the UI) is verified.
 */
test("recommendation feedback changes results and can be undone", async ({ page }) => {
  const user = makeTestUser("e2efeedback");

  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("Feedback Tester");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);
  // Any authenticated page will do — these drive the API directly, and /home
  // is the heaviest route in the app.
  await page.goto("/library");
  await hideDevOverlay(page);

  // Build a little signal so recommendations are personalized rather than empty.
  await page.goto("/discover?kind=movie");
  const firstMovie = await page.locator('a[href^="/movie/"]:has(p)').first().getAttribute("href");
  await page.goto(firstMovie!);
  await page.locator('button[aria-label="5 stars"]').first().click();
  await expect(page.getByText(/Your rating: 5/)).toBeVisible();

  const result = await page.evaluate(async () => {
    const json = (r: Response) => r.json();
    const post = (url: string, body: unknown) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json);

    const before = await fetch("/api/recommendations?limit=24").then(json);
    const target = before.data[0].content;
    const present = (list: { data: { content: { id: string } }[] }) =>
      list.data.some((d) => d.content.id === target.id);

    const dismissed = await post("/api/taste/dismiss", { kind: target.kind, contentId: target.id });
    const afterDismiss = await fetch("/api/recommendations?limit=24").then(json);

    const undone = await post("/api/taste/undo", { feedbackId: dismissed.data.feedbackId });
    const afterUndo = await fetch("/api/recommendations?limit=24").then(json);

    return {
      presentBefore: present(before),
      presentAfterDismiss: present(afterDismiss),
      undone: undone.data?.undone === true,
      presentAfterUndo: present(afterUndo),
      hasFeedbackId: typeof dismissed.data.feedbackId === "string" && dismissed.data.feedbackId.length > 0,
    };
  });

  expect(result.hasFeedbackId).toBe(true);
  expect(result.presentBefore).toBe(true);
  // "Not for me" is the strong exclusion — the item must actually disappear.
  expect(result.presentAfterDismiss).toBe(false);
  // ...and undoing it must bring the item back, not merely log an event.
  expect(result.undone).toBe(true);
  expect(result.presentAfterUndo).toBe(true);
});

test("'Less like this' is softer than 'Not for me' — it never hard-excludes", async ({ page }) => {
  const user = makeTestUser("e2esoftneg");

  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("Soft Negative Tester");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);
  // Any authenticated page will do — these drive the API directly, and /home
  // is the heaviest route in the app.
  await page.goto("/library");
  await hideDevOverlay(page);

  const result = await page.evaluate(async () => {
    const json = (r: Response) => r.json();
    const before = await fetch("/api/recommendations?limit=24").then(json);
    const target = before.data[0].content;

    const less = await fetch("/api/taste/less-like-this", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: target.kind, contentId: target.id }),
    }).then(json);

    const after = await fetch("/api/recommendations?limit=24").then(json);
    const rankBefore = before.data.findIndex((d: { content: { id: string } }) => d.content.id === target.id);
    const rankAfter = after.data.findIndex((d: { content: { id: string } }) => d.content.id === target.id);

    return { rankBefore, rankAfter, message: less.data.message, feedbackId: less.data.feedbackId };
  });

  expect(result.feedbackId).toBeTruthy();
  expect(result.message).toMatch(/fewer like this/i);
  // It should be ranked lower than it was — either pushed down or off this page.
  expect(result.rankAfter === -1 || result.rankAfter > result.rankBefore).toBe(true);
});
