import { preservedCacheRecords } from "./retired-collections-records";
import Dexie from "dexie";
import { AvaReaderDB, DB_NAME } from "../db";
import { payload } from "../buckets/library/test-fixture";
import {
  collectionToRow,
  bookToItemRow,
} from "../buckets/library/collections/payload-rows";
import { book } from "../buckets/library/membership/test-fixture";
import { buildBookInfoRow } from "../buckets/library/book-info/build-book-info-row";
import { homeFixture } from "../buckets/home/test-fixture";

export async function seedRetiredCollections() {
  const template = new AvaReaderDB(DB_NAME);
  const stores = Object.fromEntries(
    template.tables.map(({ name, schema }) => [
      name,
      [schema.primKey.src, ...schema.indexes.map((index) => index.src)].join(
        ",",
      ),
    ]),
  );
  template.close();
  const old = new Dexie(DB_NAME);
  old.version(5).stores(stores);
  const defaults = [
    "imported-library",
    "public-domain-library",
    "offline-books",
  ].map((smartKey) => ({
    ...collectionToRow(payload().collections[0]),
    id: smartKey,
    slug: smartKey,
    smartKey,
    kind: "SMART" as const,
    name: smartKey,
  }));
  const custom = defaults.map((row) => ({
    ...row,
    id: `custom-${row.id}`,
    kind: "CUSTOM" as const,
    smartKey: null,
  }));
  const all = [...defaults, ...custom];
  await old.table("collections").bulkPut(all);
  const row = buildBookInfoRow({
    book: { ...book, collections: all, offlineRequested: true },
    prior: undefined,
    finishedAt: null,
    retainCollections: false,
    nowIso: "2026-10-25T00:00:00Z",
  });
  row.savedOffline = true;
  row.offlineRequestedDirty = true;
  await old
    .table("libraryItems")
    .bulkPut([row, bookToItemRow(payload().collections[0].books[1], "now")]);
  await old.table("collectionMembership").bulkPut([
    ...defaults.map((collection) => ({
      collectionId: collection.id,
      libraryItemId: "lib-2",
      order: 0,
    })),
    { collectionId: custom[0].id, libraryItemId: "lib-1", order: 0 },
  ]);
  const home = homeFixture();
  home.collections.items = all;
  await old.table("home").put({ id: "me", payload: home, fetchedAt: "before" });
  const records = preservedCacheRecords(custom[0].id);
  for (const [table, value] of Object.entries(records))
    await old.table(table).put(value);
  const before = Object.fromEntries(
    await Promise.all(
      Object.keys(records).map(async (table) => [
        table,
        await old.table(table).toArray(),
      ]),
    ),
  );
  const beforeItems = await old.table("libraryItems").toArray();
  return { old, stores, custom, before, beforeItems };
}
