import { expect, it } from "vitest";
import type { LibraryItemRow, ProgressRow } from "../../db";
import { selectCurrentReadingBook } from "./select-current-reading-book";

const book = (id: string) =>
  ({
    libraryItemId: id,
    title: id,
    authors: ["Author of " + id],
    completionPercent: 0,
    finishedAt: null,
  }) as LibraryItemRow;
const progress = (id: string, date: string, completionPercent = 1) =>
  ({ libraryItemId: id, lastReadAt: date, completionPercent }) as ProgressRow;
const server = {
  libraryItemId: "old",
  title: "Old book",
  lastReadAt: "2026-10-01T10:00:00Z",
};

it("replaces the displayed title and author immediately after another book is read offline", () => {
  expect(
    selectCurrentReadingBook({
      server,
      books: [book("new")],
      progress: [progress("new", "2026-10-08T10:00:00Z")],
      finishDates: [],
    }),
  ).toMatchObject({ title: "new", authors: ["Author of new"] });
});
it("ignores added/opened books that have no reading progress", () => {
  expect(
    selectCurrentReadingBook({
      server: null,
      books: [book("unread")],
      progress: [],
      finishDates: [],
    }),
  ).toBeNull();
});
it("omits completed books and respects unsynced finish dates", () => {
  expect(
    selectCurrentReadingBook({
      server,
      books: [book("old")],
      progress: [progress("old", server.lastReadAt, 100)],
      finishDates: [],
    }),
  ).toBeNull();
  expect(
    selectCurrentReadingBook({
      server,
      books: [],
      progress: [],
      finishDates: [
        {
          libraryItemId: "old",
          finishedAt: "2026-10-08",
          revision: "r",
          queuedAt: "now",
        },
      ],
    }),
  ).toBeNull();
});
it("keeps a server reading title on a fresh device without a cached library", () => {
  expect(
    selectCurrentReadingBook({
      server,
      books: [],
      progress: [],
      finishDates: [],
    }),
  ).toEqual(server);
});
