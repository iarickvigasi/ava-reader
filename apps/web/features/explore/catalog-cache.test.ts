import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import Dexie from "dexie";
import {
  __resetDbForTests,
  getDb,
  setActiveUser,
  dbNameForUser,
} from "@/features/offline/db";
import { readCatalogCache, writeCatalogCache } from "./catalog-cache";

beforeEach(async () => {
  __resetDbForTests();
  for (const user of ["catalog-test-a", "catalog-test-b"])
    await Dexie.delete(dbNameForUser(user));
  setActiveUser("catalog-test-a");
});
afterEach(() => __resetDbForTests());

it("bounds cached public queries while preserving unrelated user intent", async () => {
  await getDb().meta.put({
    key: "pending-private-intent",
    value: 1,
    updatedAt: "2026-01-01",
  });
  for (let index = 0; index < 45; index++)
    await writeCatalogCache(`works?query=${index}`, { items: [index] });
  expect(
    await getDb().meta.where("key").startsWith("catalog:public:").count(),
  ).toBe(40);
  expect(await getDb().meta.get("pending-private-intent")).toBeDefined();
});

it("uses per-account storage and skips oversized metadata", async () => {
  await writeCatalogCache("works", { items: [1] });
  setActiveUser("catalog-test-b");
  expect(await readCatalogCache("works")).toBeNull();
  await writeCatalogCache("large", "x".repeat(512_001));
  expect(await readCatalogCache("large")).toBeNull();
});
