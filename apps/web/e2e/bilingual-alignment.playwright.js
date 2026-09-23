/* eslint-disable @typescript-eslint/no-require-imports */
const { test, expect } = require("playwright/test");
const overlay = "[data-bilingual-alignment-overlay]";
const closePanel = (page) => page.getByRole("button", { name: "Close AI toolbox panel", exact: true });
const sentence = (page, side) => page.locator(`[data-bilingual-column="${side}"] [data-bilingual-unit-id="fixture-opening-0"]`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("ava-reader:resume:bilingual-fixture");
    localStorage.setItem("ava.reader.translateTargetLang", "English");
  });
  await page.route("**/api/library/bilingual-fixture/**", (route) => route.abort());
});

async function open(page, phone = false) {
  await page.goto(`/dev/bilingual-fixture?annotations=1${phone ? "&phone=1" : ""}`);
  await page.locator('[data-fixture-ready="true"]').waitFor();
  if (!(await page.locator('[data-bilingual-reader]').count())) await page.locator("[data-reader-bilingual-toggle]:visible").click();
  await expect(sentence(page, "source")).toBeVisible();
  if (!phone) await page.locator('[data-bilingual-column="source"]').click({ position: { x: 200, y: 5 } });
}

async function point(page, side) {
  const p = await sentence(page, side).evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 2);
    const rect = range.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await expect.poll(() => page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-bilingual-unit-id="fixture-opening-0"]'), p)).toBe(true);
  return p;
}

test("hover and click align both columns; selection restores saved comments without painted annotations", async ({ page }) => {
  await open(page);
  await expect(page.locator("[data-bilingual-reader] mark")).toHaveCount(0);
  for (const side of ["source", "translation"]) {
    const p = await point(page, side);
    await page.mouse.move(p.x, p.y);
    await expect(page.locator(`${overlay} > div`)).toHaveCount(2);
    if (side === "source") await page.screenshot({ path: "/private/tmp/ava-alignment-yellow.png" });
    await page.mouse.click(p.x, p.y);
    expect(page.url()).not.toContain("#fixture-link");
    await expect(closePanel(page)).toHaveCount(0);
    await page.mouse.dblclick(p.x, p.y);
    await expect(closePanel(page)).toBeVisible();
    await expect(page.getByText(`Saved explanation of the ${side === "source" ? "original" : "translated"} word.`, { exact: true })).toBeVisible();
    await expect(page.locator(overlay)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(closePanel(page)).toHaveCount(0);
    await page.locator('[data-bilingual-column="source"]').click({ position: { x: 200, y: 5 } });
  }
  await page.locator("[data-reader-bilingual-toggle]:visible").click();
  await expect(page.locator("mark.ai-comment-mark").first()).toBeVisible();
});

test.describe("iOS gesture ownership", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" });
  test("short tap aligns; long press opens existing comments on either side", async ({ page, context }) => {
    await open(page, true);
    const cdp = await context.newCDPSession(page);
    for (const side of ["source", "translation"]) {
      const p = await point(page, side);
      await page.touchscreen.tap(p.x, p.y);
      await expect(page.locator(`${overlay} > div`)).toHaveCount(2);
      await expect(closePanel(page)).toHaveCount(0);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
      await page.waitForTimeout(450);
      await expect(page.locator(overlay)).toHaveCount(0);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(closePanel(page)).toBeVisible();
      await expect(page.getByText(`Saved explanation of the ${side === "source" ? "original" : "translated"} word.`, { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await expect(page.locator("[data-bilingual-reader] mark")).toHaveCount(0);
  });
  test("long-press dragging selects without turning the page; an early swipe navigates", async ({ page, context }) => {
    await open(page, true);
    const cdp = await context.newCDPSession(page);
    const p = await point(page, "source");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
    await page.waitForTimeout(450);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p.x + 90, y: p.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(closePanel(page)).toBeVisible();
    await expect(page.locator('[data-bilingual-reader] footer')).toContainText("Page 1");
    await expect(page.locator(overlay)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(closePanel(page)).toHaveCount(0);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x + 150, y: p.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator('[data-bilingual-reader] footer')).toContainText("Page 2");
    await expect(page.locator(overlay)).toHaveCount(0);
    await expect(closePanel(page)).toHaveCount(0);
  });
});
