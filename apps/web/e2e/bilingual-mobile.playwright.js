/* eslint-disable @typescript-eslint/no-require-imports */
const { expect, test } = require("playwright/test");
const toggle = (page) => page.locator("[data-reader-bilingual-toggle]:visible");
const columns = (page) => page.locator("[data-bilingual-column]");

test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 390, height: 844 },
});

test("manual phone mode keeps equal stacked panes through rotation and paging", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    localStorage.removeItem("ava-reader:resume:bilingual-fixture");
    localStorage.setItem("ava.reader.translateTargetLang", "English");
    localStorage.setItem("ava.reader.fontScale", "1");
  });
  await page.route("**/api/library/bilingual-fixture/**", (route) =>
    route.abort(),
  );
  await page.goto("/dev/bilingual-fixture?phone=1", {
    waitUntil: "domcontentloaded",
  });
  await page.locator('[data-fixture-ready="true"]').waitFor();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(columns(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await toggle(page).click();
  await stacked(page);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  const client = await context.newCDPSession(page);
  const box = await columns(page).first().boundingBox();
  for (const [type, x] of [
    ["touchStart", 650],
    ["touchMove", 400],
    ["touchEnd", 200],
  ]) {
    await client.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y: box.y + 15 }],
    });
  }
  await expect(page.locator("[data-bilingual-reader] footer")).toContainText(
    "Page 2",
  );
  await stacked(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await stacked(page);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "/tmp/ava-bilingual-mobile.png" });
  await toggle(page).click();
  await expect(columns(page)).toHaveCount(0);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await page.locator('[data-fixture-ready="true"]').waitFor();
  await expect(columns(page)).toHaveCount(0);
});

async function stacked(page) {
  await expect(columns(page)).toHaveCount(2);
  await expect
    .poll(async () =>
      columns(page).evaluateAll((panes) => {
        const [source, translation] = panes.map((pane) =>
          pane.getBoundingClientRect(),
        );
        return (
          source.width > 0 &&
          source.height > 0 &&
          source.x === translation.x &&
          source.width === translation.width &&
          source.height === translation.height &&
          translation.top - source.bottom === 16 &&
          panes.every((pane) => pane.scrollHeight <= pane.clientHeight + 1)
        );
      }),
    )
    .toBe(true);
  const header = page.locator('[data-reader-mobile-navigation="header"]');
  await expect(header).toBeVisible();
  await expect(header.locator("nav button")).toHaveCount(6);
  await expect
    .poll(() =>
      header
        .locator("nav")
        .evaluate((nav) => nav.scrollWidth - nav.clientWidth),
    )
    .toBe(0);
}
