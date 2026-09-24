/* eslint-disable @typescript-eslint/no-require-imports */
const { expect, test } = require("playwright/test");
const {
  fits,
  readerMetrics,
  paragraphFlowsInline,
} = require("./bilingual-assertions");
const TARGET = '[data-bilingual-column="translation"]';
const RESUME = "ava-reader:resume:bilingual-fixture";
const toggle = (page) => page.locator("[data-reader-bilingual-toggle]:visible");
const label = (page) =>
  page.locator("[data-bilingual-reader] footer span").last();
const resume = (page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key))?.locator,
    RESUME,
  );

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
    localStorage.setItem("ava.reader.translateTargetLang", "English");
    localStorage.setItem("ava.reader.fontScale", "1");
  }, RESUME);
  await page.route("**/api/library/bilingual-fixture/**", (route) =>
    route.abort(),
  );
});

async function open(page, automatic = false) {
  await page.goto("/dev/bilingual-fixture", { waitUntil: "domcontentloaded" });
  await page.locator('[data-fixture-ready="true"]').waitFor();
  let baseline;
  if (!automatic) {
    await page
      .locator('[data-reader-page-viewport] [data-block-id="fixture-opening"]')
      .first()
      .waitFor();
    baseline = await readerMetrics(page);
    await toggle(page).click();
  }
  await page.locator(TARGET).waitFor();
  await expect(
    page.locator(`${TARGET} [data-bilingual-unit-id]`).first(),
  ).toBeVisible();
  if (baseline) expect(await readerMetrics(page)).toEqual(baseline);
  await page
    .locator('[data-bilingual-column="source"]')
    .click({ position: { x: 200, y: 5 } });
}

test("desktop paginates long translations without scrolling and reuses cache after reflow", async ({
  page,
}) => {
  const generations = [];
  page.on("request", (request) => {
    if (request.url().includes("/translations/generate"))
      generations.push(request.url());
  });
  await open(page);
  await fits(page);
  await paragraphFlowsInline(page);
  await page.screenshot({ path: "/tmp/ava-bilingual-desktop.png" });
  await page.keyboard.press("ArrowRight");
  await expect(label(page)).toHaveText("Page 2");
  await expect(
    page.locator(`${TARGET} [data-bilingual-unit-id="fixture-long"]`),
  ).toBeVisible();
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press("ArrowRight");
    await expect(label(page)).toHaveText(`Page ${index + 3}`);
    await fits(page);
  }
  const before = await resume(page);
  await page.screenshot({ path: "/tmp/ava-bilingual-continuation.png" });
  expect(before.blockId).toBe("fixture-long");
  expect(before.textOffset).toBeGreaterThan(0);
  await page.setViewportSize({ width: 930, height: 560 });
  await fits(page);
  await expect
    .poll(async () => (await resume(page))?.blockId)
    .toBe("fixture-long");
  await page.setViewportSize({ width: 1200, height: 720 });
  await toggle(page).click();
  await expect(page.locator(TARGET)).toHaveCount(0);
  await expect
    .poll(async () => (await resume(page))?.blockId)
    .toBe("fixture-long");
  await toggle(page).click();
  await page.locator(TARGET).waitFor();
  await fits(page);
  expect(generations).toEqual([]);
});
