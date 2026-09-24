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

module.exports = {
  fits,
  readerMetrics,
  paragraphFlowsInline,
};
