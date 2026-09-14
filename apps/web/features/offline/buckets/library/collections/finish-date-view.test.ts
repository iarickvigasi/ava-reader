import { expect, it } from "vitest";
import type { LibraryItemRow } from "../../../db";
import { payload } from "../test-fixture";
import { buildMembershipCollectionView } from "./collection-view";
import { bookToItemRow, collectionToRow, membershipRows } from "./payload-rows";
import { collectionViewToLibraryCollection } from "./view-to-collection";

const date = "2026-09-14T12:00:00.000Z";

it.each([date, null])("carries a card's finish date %s through view and route payload mappings", (finishedAt) => {
  const collection = payload().collections[0];
  collection.books[0].finishedAt = finishedAt;
  const view = buildMembershipCollectionView(collectionToRow(collection),
    collection.books.map((book) => bookToItemRow(book, date)), membershipRows(collection));
  expect(view.books[0].finishedAt).toBe(finishedAt);
  expect(collectionViewToLibraryCollection(view).books[0].finishedAt).toBe(finishedAt);
});

it("uses legacy detail dates in card views and keeps completion snapshots out of route hydration", () => {
  const collection = payload().collections[0];
  const row = bookToItemRow(collection.books[0], date);
  row.details = { finishedAt: date } as LibraryItemRow["details"];
  const view = buildMembershipCollectionView(collectionToRow(collection), [row], membershipRows(collection));
  view.completionItems = [{ libraryItemId: row.libraryItemId, finishedAt: date, completionPercent: 10 }];
  const route = collectionViewToLibraryCollection(view);
  expect(route.books[0].finishedAt).toBe(date);
  expect(route.completionItems).toBeUndefined();
});
