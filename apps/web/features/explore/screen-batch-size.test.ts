import { expect, it } from "vitest";
import { screenBatchSize } from "./screen-batch-size";

it("loads the remaining first screen, then a full next screen on desktop", () => {
  expect(
    screenBatchSize({ width: 1080, height: 900, columns: 5, top: 480 }),
  ).toBe(5);
  expect(
    screenBatchSize({ width: 1080, height: 900, columns: 5, top: 0 }),
  ).toBe(10);
});

it("fits mobile rows and bounds very large viewports", () => {
  expect(
    screenBatchSize({ width: 330, height: 800, columns: 2, top: 400 }),
  ).toBe(2);
  expect(screenBatchSize({ width: 330, height: 800, columns: 2, top: 0 })).toBe(
    4,
  );
  expect(
    screenBatchSize({ width: 1080, height: 10000, columns: 5, top: 0 }),
  ).toBe(40);
});
