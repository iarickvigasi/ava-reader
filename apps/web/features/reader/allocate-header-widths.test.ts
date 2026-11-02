import { expect, it } from "vitest";
import { allocateHeaderWidths } from "./allocate-header-widths";

it.each([
  [
    "all fields fit despite author exceeding its share",
    { title: 25, author: 40, chapter: 10 },
    100,
    { title: 25, author: 40, chapter: 10 },
  ],
  [
    "short chapter gives space back to long title",
    { title: 120, author: 25, chapter: 5 },
    100,
    { title: 70, author: 25, chapter: 5 },
  ],
  [
    "author reclaims unused chapter space first",
    { title: 120, author: 45, chapter: 5 },
    100,
    { title: 50, author: 45, chapter: 5 },
  ],
  [
    "all fields overflow",
    { title: 100, author: 100, chapter: 100 },
    100,
    { title: 40, author: 30, chapter: 30 },
  ],
  [
    "missing author leaves room for chapter",
    { title: 20, author: 0, chapter: 100 },
    100,
    { title: 20, author: 0, chapter: 80 },
  ],
  [
    "no available space",
    { title: 20, author: 10, chapter: 5 },
    -5,
    { title: 0, author: 0, chapter: 0 },
  ],
])("%s", (_, natural, available, expected) => {
  expect(allocateHeaderWidths(natural, available)).toEqual(expected);
});
