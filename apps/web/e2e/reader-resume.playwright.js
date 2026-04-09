/* eslint-disable @typescript-eslint/no-require-imports */
const { expect, test } = require("@playwright/test");

const FIXTURE_STORAGE_KEY = "ava-reader:resume:reader-resume-fixture";

test.describe("reader resume fixture", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ storageKey }) => {
        window.localStorage.removeItem(storageKey);
      },
      {
        storageKey: FIXTURE_STORAGE_KEY,
      },
    );
  });

  test("reopens inside a long paragraph without falling back to page one", async ({
    page,
  }) => {
    await page.goto("/dev/reader-resume-fixture");

    await page.getByRole("button", { name: "Reader panel" }).waitFor();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    const pageLabelBeforeReload = await page
      .getByText(/Page \d+ of \d+/)
      .first()
      .textContent();
    const storedSnapshot = await page.evaluate(
      ({ storageKey }) => {
        return window.localStorage.getItem(storageKey);
      },
      {
        storageKey: FIXTURE_STORAGE_KEY,
      },
    );

    await page.reload();
    await page
      .getByText(/Restoring your last page|Page \d+ of \d+/)
      .first()
      .waitFor();

    const pageLabelAfterReload = await page
      .getByText(/Page \d+ of \d+/)
      .first()
      .textContent();
    const storedSnapshotAfterReload = await page.evaluate(
      ({ storageKey }) => {
        return window.localStorage.getItem(storageKey);
      },
      {
        storageKey: FIXTURE_STORAGE_KEY,
      },
    );

    expect(storedSnapshot).toContain('"version":2');
    expect(storedSnapshotAfterReload).toContain('"version":2');
    expect(pageLabelBeforeReload).not.toBe("Page 1 of 1");
    expect(pageLabelAfterReload).toBe(pageLabelBeforeReload);
    expect(pageLabelAfterReload).not.toContain("Page 1 of");
  });

  test("ignores a stale local snapshot without version 2", async ({ page }) => {
    await page.addInitScript(
      ({ storageKey }) => {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            locator: {
              blockId: "chapter-1::paragraph-long",
              chapterId: "chapter-1",
              textOffset: 999,
            },
            savedAt: "2026-04-09T12:15:00.000Z",
          }),
        );
      },
      {
        storageKey: FIXTURE_STORAGE_KEY,
      },
    );

    await page.goto("/dev/reader-resume-fixture");
    await page.getByRole("button", { name: "Reader panel" }).waitFor();

    const storedSnapshot = await page.evaluate(
      ({ storageKey }) => {
        return window.localStorage.getItem(storageKey);
      },
      {
        storageKey: FIXTURE_STORAGE_KEY,
      },
    );

    expect(
      storedSnapshot === null || storedSnapshot.includes('"version":2'),
    ).toBe(true);
  });
});
