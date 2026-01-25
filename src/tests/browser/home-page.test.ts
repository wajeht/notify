import { test, expect } from "@playwright/test";

test("can get / page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Notify/);
});

test("can login and redirect to GitHub", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "🚀 Get Started" }).click();

  await expect(page.getByText("Login to get started with Notify.")).toBeVisible();

  const githubPromise = page.waitForURL("https://github.com/**");

  await page.getByRole("button", { name: "🐙 Login with GitHub" }).click();

  await githubPromise;

  expect(page.url()).toContain("github.com");
});
