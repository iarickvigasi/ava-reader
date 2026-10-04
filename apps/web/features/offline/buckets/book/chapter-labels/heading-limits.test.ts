import { expect, it } from "vitest";
import type { ReaderBlock } from "@/lib/api-types/reader";
import { hasRepairableOpening } from "./has-repairable-opening";

const heading = (text: string): ReaderBlock => ({
  kind: "heading",
  level: 6,
  id: text,
  text,
  inlines: [],
});
const publisher = "Constable & Robinson Ltd";
const entry = { label: publisher, spineIndex: 3 };

it("does not repeatedly fetch an unchanged publisher name from an oversized group", () => {
  const blocks = [
    publisher,
    "55–56 Russell Square",
    "London WC1B 4HP",
    "www.constablerobinson.com",
  ].map(heading);
  expect(hasRepairableOpening(blocks, entry, "Book")).toBe(false);
  expect(
    hasRepairableOpening(
      [heading(publisher), heading("Legal notice. ".repeat(30))],
      entry,
      "Book",
    ),
  ).toBe(false);
  expect(
    hasRepairableOpening(blocks, { ...entry, label: "4. Publisher…" }, "Book"),
  ).toBe(true);
});

it("still refreshes valid three-part names with duplicated source headings", () => {
  const blocks = [
    "CHAPTER TWO",
    "NATURAL HISTORY",
    "Bemushroomed",
    "Bemushroomed",
  ].map(heading);
  expect(
    hasRepairableOpening(
      blocks,
      { label: "CHAPTER TWO", spineIndex: 2 },
      "Book",
    ),
  ).toBe(true);
});
