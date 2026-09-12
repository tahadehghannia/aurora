import { test, expect } from "@playwright/test";
import { makeTestUser } from "./helpers";

test.describe("API security & data integrity", () => {
  test("GET /api/profile never leaks the password hash", async ({ page }) => {
    const user = makeTestUser("e2e-profile");
    await page.goto("/signup");
    await page.getByLabel("Name", { exact: true }).fill("Profile Tester");
    await page.getByLabel("Username").fill(user.username);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/onboarding/);

    const res = await page.request.get("/api/profile");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("passwordHash");
    expect(body.data).not.toHaveProperty("passwordHash");
    expect(body.data.email).toBe(user.email);
  });

  test("concurrent registrations for the same email never both succeed and never 500", async ({ request }) => {
    const user = makeTestUser("e2e-race");
    const payload = { name: "Race Tester", username: user.username, email: user.email, password: user.password };

    // A second signup racing the first only differs by username, so the
    // email uniqueness check is what's actually being exercised here.
    const [first, second] = await Promise.all([
      request.post("/api/register", { data: payload }),
      request.post("/api/register", { data: { ...payload, username: `${user.username}b` } }),
    ]);

    const statuses = [first.status(), second.status()].sort();
    // Exactly one request should win with 201; the other must fail with a
    // clean 409 (EMAIL_TAKEN), never an unhandled 500 from the unique
    // constraint hitting the database after both requests passed the
    // pre-insert existence check.
    expect(statuses).toEqual([201, 409]);

    const loser = first.status() === 409 ? first : second;
    const loserBody = await loser.json();
    expect(loserBody.error.code).toBe("EMAIL_TAKEN");
  });

  test("GET /api/library rejects an unknown kind instead of silently returning everything", async ({ page }) => {
    const user = makeTestUser("e2elib");
    await page.goto("/signup");
    await page.getByLabel("Name", { exact: true }).fill("Library Kind Tester");
    await page.getByLabel("Username").fill(user.username);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/onboarding/);

    const res = await page.request.get("/api/library?kind=not-a-real-kind");
    expect(res.status()).toBe(400);
  });
});
