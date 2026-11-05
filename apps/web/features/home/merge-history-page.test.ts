import { expect, it } from "vitest";
import { mergeHistoryPage } from "./merge-history-page";
import { checkpointHome } from "../offline/stats/checkpoint-fixture";

it("keeps the newer coverage for a repeated historical window", () => {
  const newer = {
    ...checkpointHome(480, 3).readingSnapshot!,
    nextBefore: null,
  };
  const older = { ...checkpointHome(0, 1).readingSnapshot!, nextBefore: null };
  expect(mergeHistoryPage([newer], older)).toEqual([newer]);
  expect(mergeHistoryPage([older], newer)).toEqual([newer]);
});
