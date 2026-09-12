import { test, expect } from "@playwright/test";
import { makeTestUser } from "./helpers";

/**
 * Verifies the public profile view (/u/[username]) actually respects the
 * granular privacy switches — the core data-integrity guarantee of the
 * Profile privacy system: turning a section off must make it disappear from
 * what other signed-in users can see, not just visually hide a toggle.
 */
test("turning off a privacy section hides it from other users' view of the public profile", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const viewerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const viewerPage = await viewerCtx.newPage();

  const owner = makeTestUser("e2epowner");
  const viewer = makeTestUser("e2epview");

  // Owner signs up and rates a movie so Ratings/DNA have real content.
  await ownerPage.goto("/signup");
  await ownerPage.getByLabel("Name", { exact: true }).fill("Privacy Owner");
  await ownerPage.getByLabel("Username").fill(owner.username);
  await ownerPage.getByLabel("Email").fill(owner.email);
  await ownerPage.getByLabel("Password").fill(owner.password);
  await ownerPage.getByRole("button", { name: "Create account" }).click();
  await ownerPage.waitForURL(/\/onboarding/);
  await ownerPage.goto("/discover?kind=movie");
  const firstMovie = ownerPage.locator('a[href^="/movie/"]:has(p)').first();
  await firstMovie.click();
  await ownerPage.locator('button[aria-label="5 stars"]').first().click();
  await expect(ownerPage.getByText(/Your rating: 5/)).toBeVisible();

  // Viewer signs up separately.
  await viewerPage.goto("/signup");
  await viewerPage.getByLabel("Name", { exact: true }).fill("Privacy Viewer");
  await viewerPage.getByLabel("Username").fill(viewer.username);
  await viewerPage.getByLabel("Email").fill(viewer.email);
  await viewerPage.getByLabel("Password").fill(viewer.password);
  await viewerPage.getByRole("button", { name: "Create account" }).click();
  await viewerPage.waitForURL(/\/onboarding/);

  // Before any privacy changes, the viewer can see the owner's ratings.
  await viewerPage.goto(`/u/${owner.username}`);
  await expect(viewerPage.getByRole("heading", { name: "Ratings" })).toBeVisible();
  await expect(viewerPage.getByRole("heading", { name: "Entertainment DNA" })).toBeVisible();

  // Owner turns off "Ratings & Favorites" visibility.
  await ownerPage.goto("/profile/settings");
  await ownerPage.getByRole("switch", { name: "Ratings & Favorites" }).click();
  await ownerPage.getByRole("button", { name: "Save changes" }).click();
  await expect(ownerPage.getByText("Profile updated.")).toBeVisible();

  // The same viewer, reloading, no longer sees Ratings — but still sees DNA
  // (a different, still-enabled section) and no interactive taste-feedback
  // controls appear anywhere on someone else's profile.
  await viewerPage.goto(`/u/${owner.username}`);
  await expect(viewerPage.getByRole("heading", { name: "Ratings" })).not.toBeVisible();
  await expect(viewerPage.getByRole("heading", { name: "Entertainment DNA" })).toBeVisible();
  await expect(viewerPage.getByRole("button", { name: /More like/ })).toHaveCount(0);

  await ownerCtx.close();
  await viewerCtx.close();
});
