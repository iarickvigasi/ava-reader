import { expect, it } from "vitest";
import type { ReaderBlock } from "@/lib/api-types/reader";
import { hasRepairableOpening } from "./has-repairable-opening";

const centered = (text: string, fontSizeScale?: number): ReaderBlock => ({
  kind: "paragraph",
  id: text,
  text,
  inlines: [],
  align: "center",
  fontSizeScale,
});
const heading = (text: string): ReaderBlock => ({
  kind: "heading",
  level: 1,
  id: text,
  text,
  inlines: [],
});

it("refreshes centered structural headings and partial combined subtitles", () => {
  expect(
    hasRepairableOpening(
      [
        centered("CHAPTER 1"),
        centered("GIRLS RULE"),
        centered("Boys Are Behind in Education"),
      ],
      { label: "CHAPTER 1", spineIndex: 6 },
      "Book",
    ),
  ).toBe(true);
  expect(
    hasRepairableOpening(
      [heading("1"), heading("Title"), centered("Subtitle", 1.125)],
      { label: "1 / Title", spineIndex: 9 },
      "Book",
    ),
  ).toBe(true);
});

it("refreshes a numbered book-title page but not a repeated book heading above prose", () => {
  expect(
    hasRepairableOpening(
      [heading("Book")],
      { label: "8.", spineIndex: 7 },
      "Book",
    ),
  ).toBe(true);
  expect(
    hasRepairableOpening(
      [heading("Book"), centered("Body text")],
      { label: "8.", spineIndex: 7 },
      "Book",
    ),
  ).toBe(false);
});

it("does not promote an ordinary centered quotation to a heading group", () => {
  expect(
    hasRepairableOpening(
      [centered("A quotation"), centered("Its author")],
      { label: "A quotation", spineIndex: 1 },
      "Book",
    ),
  ).toBe(false);
});
