import { test, expect } from "@playwright/test";

const SSR_PAGE_TIMEOUT = 60_000;

test("TV React shell loads with device=tv without measureLayout errors", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  await page.goto("/login?device=tv", {
    waitUntil: "domcontentloaded",
    timeout: SSR_PAGE_TIMEOUT,
  });

  await expect(page.locator("[data-tv-spatial-root]")).toBeVisible({
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(page.getByRole("navigation", { name: "TV" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /my library|mi biblioteca/i }),
  ).toBeVisible();

  // Arrow-key neighbor picking is covered by tests/tv-spatial-nav.test.ts
  expect(pageErrors.filter((m) => /measureLayout/i.test(m))).toEqual([]);
  expect(
    pageErrors.filter((m) => /Cannot read properties of undefined/i.test(m)),
  ).toEqual([]);
});

test("TV library never shows Next.js 404 UI", async ({ page }) => {
  await page.goto("/library?device=tv", {
    waitUntil: "domcontentloaded",
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(page.getByText("This page could not be found.")).toHaveCount(0);
  // Unauthenticated → login with TV shell; authenticated → library content.
  await expect(page).toHaveURL(/\/(login|library)/, {
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(page.locator("[data-tv-spatial-root]")).toBeVisible({
    timeout: SSR_PAGE_TIMEOUT,
  });
});

test("TV entry /tv lands on login or library", async ({ page }) => {
  await page.goto("/tv", {
    waitUntil: "domcontentloaded",
    timeout: SSR_PAGE_TIMEOUT,
  });
  await expect(page).toHaveURL(/\/(login|library)/, {
    timeout: SSR_PAGE_TIMEOUT,
  });
});

test("webOS UA entry lands on login or library (not standalone)", async ({
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
});
