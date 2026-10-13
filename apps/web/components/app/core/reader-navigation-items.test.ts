import { expect, it } from "vitest";
import { readerNavItems, readerUtilityItems } from "./reader-navigation-items";

it("offers only implemented actions in desktop and mobile reader menus", () => {
  expect(readerNavItems.map(({ id }) => id)).toEqual([
    "contents",
    "preferences",
    "highlights",
    "aiComments",
    "bilingualMode",
  ]);
  expect(readerUtilityItems).toEqual([]);
});
