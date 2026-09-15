import { test, expect } from "@playwright/test";

const SSR_PAGE_TIMEOUT = 30_000;

test("landing page loads for signed-out visitors", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /find where to watch every title/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/sign in and pick your streaming services/i),
  ).toBeVisible();
});

test("Spanish landing page is available under the locale prefix", async ({
  page,
}) => {
  await page.goto("/es");
  await expect(
    page.getByRole("heading", {
      name: /encuentra dónde ver cada título/i,
    }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("search routes are available in both locales", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByRole("search")).toBeVisible({
    timeout: SSR_PAGE_TIMEOUT,
  });
  await page.goto("/es/search");
  await expect(page.getByRole("search")).toBeVisible({
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(
    page.getByPlaceholder(/películas o series/i).first(),
  ).toBeVisible({
    timeout: SSR_PAGE_TIMEOUT,
  });
});

test("Spanish route preserves the current query", async ({ page }) => {
  await page.goto("/es/search?type=movie");
  await expect(page).toHaveURL(/\/es\/search\?type=movie/, {
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(
    page.getByPlaceholder(/películas o series/i).first(),
  ).toBeVisible({
    timeout: SSR_PAGE_TIMEOUT,
  });
});

test("auth callback remains outside locale routing", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(/\/login\?error=auth_callback_error/);
});

test("TV entry redirects to login or library (React TV)", async ({ page }) => {
  await page.goto("/tv", {
    waitUntil: "domcontentloaded",
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(page).toHaveURL(/\/(login|library)/, {
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(page.getByText("Algo salió mal")).not.toBeVisible();
});

test("TV user-agent uses React TV entry (not standalone home)", async ({
  page,
}) => {
  await page.context().setExtraHTTPHeaders({
    "user-agent": "Mozilla/5.0 (Web0S; SmartTV)",
  });
  await page.goto("/tv", {
    waitUntil: "domcontentloaded",
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(page).toHaveURL(/\/(login|library)/, {
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(page).not.toHaveURL(/standalone/);
  await expect(page.locator("body")).toContainText("Watchily");
});
