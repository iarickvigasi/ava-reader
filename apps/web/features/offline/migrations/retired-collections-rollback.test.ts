import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DB_NAME, __resetDbForTests } from "../db";
import { migrateRetiredCollections } from "./retired-collections";
import { seedRetiredCollections } from "./retired-collections-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await Dexie.delete(DB_NAME);
});
afterEach(async () => {
  __resetDbForTests();
  await Dexie.delete(DB_NAME);
});

it("rolls back shelf and nested-reference deletion together when an upgrade fails", async () => {
  const { old, stores, beforeItems } = await seedRetiredCollections();
  const originalCollections = await old.table("collections").toArray();
  const originalHome = await old.table("home").toArray();
  old.close();
  const failing = new Dexie(DB_NAME);
  failing.version(5).stores(stores);
  failing
    .version(6)
    .stores({})
    .upgrade(async (tx) => {
      await migrateRetiredCollections(tx);
      throw new Error("Upgrade interrupted");
    });
  await expect(failing.open()).rejects.toThrow("Upgrade interrupted");
  failing.close();
  await old.open();
  expect(await old.table("collections").toArray()).toEqual(originalCollections);
  expect(await old.table("libraryItems").toArray()).toEqual(beforeItems);
  expect(await old.table("home").toArray()).toEqual(originalHome);
  old.close();
});
