import { expect, it } from "vitest";
import { toolbarVisibleItems } from "./toolbar-visible-items";
const ids = [
  "contents",
  "preferences",
  "aiChats",
  "highlights",
  "aiComments",
  "bilingualMode",
];
it("keeps all actions when they fit without reserving an unnecessary trigger", () => {
  expect(
    toolbarVisibleItems([32, 32, 32, 32, 32, 32], 212, 4, 32, ids),
  ).toEqual(ids);
});
it("reserves the trigger and prioritizes bilingual mode while keeping display order", () => {
  expect(
    toolbarVisibleItems([32, 32, 32, 32, 32, 32], 140, 4, 32, ids),
  ).toEqual(["contents", "preferences", "bilingualMode"]);
});
it("supports variable control sizes and a menu-only toolbar", () => {
  expect(
    toolbarVisibleItems([40, 48, 32, 32, 32, 36], 160, 8, 40, ids),
  ).toEqual(["contents", "preferences"]);
  expect(toolbarVisibleItems([32, 32, 32, 32, 32, 32], 32, 4, 32, ids)).toEqual(
    [],
  );
});
