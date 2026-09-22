/* eslint-disable @typescript-eslint/no-require-imports */
const { expect } = require("playwright/test");

async function fits(page) {
  const boxes = await page
    .locator("[data-bilingual-column]")
    .evaluateAll((columns) =>
      columns.map((column) => {
        const box = column.getBoundingClientRect();
        const viewport = column
          .closest("[data-reader-page-viewport]")
          .getBoundingClientRect();
        const inkBleed = 6;
        const range = document.createRange();
        const walker = document.createTreeWalker(column, NodeFilter.SHOW_TEXT);
        let clipped = 0;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.right <= box.left + 1 || rect.left >= box.right - 1)
              continue;
            // Headings may paint beyond their line box, inside the page margin.
            const exceedsBleed =
              rect.top < box.top - inkBleed ||
              rect.bottom > box.bottom + inkBleed;
            const outsideViewport =
              rect.top < viewport.top - 1 ||
              rect.bottom > viewport.bottom + 1 ||
              rect.left < viewport.left - 1 ||
              rect.right > viewport.right + 1;
            if (exceedsBleed || outsideViewport) clipped++;
          }
        }
        return {
          left: box.left,
          right: box.right,
          height: box.height,
          overflow: column.scrollHeight - column.clientHeight,
          clipped,
        };
      }),
    );
  expect(boxes).toHaveLength(2);
  expect(boxes[0].right).toBeLessThan(boxes[1].left);
  for (const box of boxes) {
    expect(box.height).toBeGreaterThan(100);
    expect(box.overflow).toBeLessThanOrEqual(1);
    expect(box.clipped).toBe(0);
  }
}

async function readerMetrics(page) {
  return page
    .locator("[data-reader-frame]")
    .first()
    .evaluate((frame) => {
      const header = frame.querySelector("header h1");
      const body = frame.querySelector(
        '[data-reader-page-viewport] [data-block-id="fixture-opening"]',
      );
      const style = (element) => {
        const { fontFamily, fontSize, lineHeight } = getComputedStyle(element);
        return { fontFamily, fontSize, lineHeight };
      };
      const box = header.getBoundingClientRect();
      return {
        header: {
          ...style(header),
          text: header.textContent,
          top: box.top,
          height: box.height,
        },
        body: style(body),
      };
    });
}

async function paragraphFlowsInline(page) {
  const result = await page
    .locator("[data-bilingual-column]")
    .evaluateAll((columns) =>
      columns.map((column) => {
        const units = Array.from(
          column.querySelectorAll(
            '[data-bilingual-unit-id^="fixture-opening-"]',
          ),
        );
        const first = units[0];
        const second = units[1];
        return {
          count: units.length,
          sameParagraph:
            Boolean(first?.closest("p")) &&
            units.every((unit) => unit.closest("p") === first.closest("p")),
          firstTop: first?.getClientRects()[0]?.top,
          secondTop: second?.getClientRects()[0]?.top,
        };
      }),
    );
  for (const side of result) {
    expect(side.count).toBe(4);
    expect(side.sameParagraph).toBe(true);
  }
  expect(Math.abs(result[0].firstTop - result[0].secondTop)).toBeLessThan(1);
}

async function compactPhoneRail(page) {
  const rail = page.locator('[data-reader-mobile-navigation="rail"]');
  await expect(rail).toBeVisible();
  const metrics = await rail.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      overflow: element.scrollHeight - element.clientHeight,
      buttons: Array.from(element.querySelectorAll("nav button"), (button) => {
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      }),
    };
  });
  expect(metrics.left).toBe(0);
  expect(metrics.top).toBe(0);
  expect(metrics.width).toBe(44);
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.buttons).toHaveLength(5);
  for (let index = 0; index < metrics.buttons.length; index++) {
    const button = metrics.buttons[index];
    expect(button.width).toBe(32);
    expect(button.height).toBe(32);
    expect(button.left).toBe(metrics.buttons[0].left);
    if (index) expect(button.top - metrics.buttons[index - 1].bottom).toBe(4);
  }
  const column = await page
    .locator('[data-bilingual-column="source"]')
    .boundingBox();
  expect(column.x).toBeGreaterThanOrEqual(metrics.width);
  expect(column.y).toBeLessThan(24);
  expect(column.height).toBeGreaterThan(280);
}

module.exports = {
  fits,
  readerMetrics,
  paragraphFlowsInline,
  compactPhoneRail,
};
