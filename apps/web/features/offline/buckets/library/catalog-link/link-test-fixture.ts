import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { clearCatalogLinkRuntime } from "./bucket";
import type { CatalogLink } from "./types";
export const token = async () => "token";
export const link: CatalogLink = {
  workId: "work",
  title: "Classic",
  authors: ["Author"],
  revision: 1,
};
export const request = vi.fn();
beforeEach(async () => {
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  vi.stubGlobal("fetch", request);
  request.mockReset();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(async () => {
  clearCatalogLinkRuntime();
  await getDb().delete();
  __resetDbForTests();
  vi.unstubAllGlobals();
});
