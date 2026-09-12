import { test, expect } from "@playwright/test";
import { makeTestUser, hideDevOverlay } from "./helpers";

test.describe("authentication", () => {
  test("rejects an incorrect password with a clear error, then succeeds with the right one", async ({ page }) => {
    const user = makeTestUser("e2e-auth");

    // Register first so there's a real account to log into.
    await page.goto("/signup");
    await page.getByLabel("Name", { exact: true }).fill("Auth Tester");
    await page.getByLabel("Username").fill(user.username);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/onboarding/);

    // Sign out by going straight to the login page (clears nothing, but confirms login works standalone).
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill("TheWrongPassword1");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/home/);
  });

  test("redirects an unauthenticated visitor from a protected page to /login", async ({ page }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/login/);
  });

  test("signing out returns the user to a logged-out state", async ({ page }) => {
    const user = makeTestUser("e2e-signout");
    await page.goto("/signup");
    await page.getByLabel("Name", { exact: true }).fill("Signout Tester");
    await page.getByLabel("Username").fill(user.username);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/onboarding/);
    await page.goto("/home");
    await hideDevOverlay(page);

    await page.getByRole("button", { name: /^[A-Z]{1,2}$/ }).click(); // avatar initials trigger
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/");
    await page.goto("/library");
    await expect(page).toHaveURL(/\/login/);
  });
});
