import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, expect, it } from "vitest";
import { AvaReaderDB, SCHEMA_VERSION } from "../db";
import { databaseAccess, openAccountDatabase } from "./database-access";

const names: string[] = [];
const connections: Dexie[] = [];
function track<T extends Dexie>(db: T): T {
  names.push(db.name);
  connections.push(db);
  return db;
}
afterEach(async () => {
  connections.splice(0).forEach((db) => db.close());
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)));
});

it.each(["explicit", "automatic"])(
  "refuses %s opens without patching or writing",
  async (mode) => {
    const name = `future-${mode}`;
    const future = track(new Dexie(name));
    // Deliberately omit current stores: Dexie would otherwise patch this schema.
    future
      .version(SCHEMA_VERSION + 1)
      .stores({ meta: "key", futureQueue: "id" });
    await future.open();
    await future.table("futureQueue").put({ id: "pending", value: "keep" });
    future.close();
    const old = track(new AvaReaderDB(name));
    const operation =
      mode === "explicit"
        ? old.open()
        : old.meta.put({ key: "bad", value: true, updatedAt: "now" });
    await expect(operation).rejects.toThrow("newer app version");
    expect(databaseAccess(old).state).toBe("update-required");
    expect(old.isOpen()).toBe(false);
    await future.open();
    expect(future.backendDB().version).toBe((SCHEMA_VERSION + 1) * 10);
    expect(Array.from(future.backendDB().objectStoreNames)).toEqual([
      "futureQueue",
      "meta",
    ]);
    expect(await future.table("futureQueue").toArray()).toEqual([
      { id: "pending", value: "keep" },
    ]);
    expect(await future.table("meta").count()).toBe(0);
  },
);

it("opens fresh/current databases and keeps account states independent", async () => {
  const db = track(new AvaReaderDB("current"));
  await openAccountDatabase(db);
  expect(databaseAccess(db).state).toBe("ready");
  db.close();
  await openAccountDatabase(db);
  expect(databaseAccess(db).state).toBe("ready");
  expect(databaseAccess(track(new AvaReaderDB("other"))).state).toBe("opening");
});

it("accepts native patch increments within the supported schema", async () => {
  const db = track(new AvaReaderDB("patch"));
  await db.open();
  db.close();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(db.name, SCHEMA_VERSION * 10 + 1);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
  await openAccountDatabase(db);
  expect(databaseAccess(db).state).toBe("ready");
});

it("blocks an existing connection when another tab upgrades", async () => {
  const old = track(new AvaReaderDB("tabs"));
  await openAccountDatabase(old);
  const newer = track(new Dexie(old.name));
  newer.version(SCHEMA_VERSION + 1).stores({ meta: "key" });
  await newer.open();
  expect(databaseAccess(old).state).toBe("update-required");
  expect(old.isOpen()).toBe(false);
  await expect(old.meta.get("anything")).rejects.toThrow();
  const other = track(new AvaReaderDB("other-account"));
  await openAccountDatabase(other);
  expect(databaseAccess(other).state).toBe("ready");
});

it("keeps ordinary open failures distinct from compatibility failures", async () => {
  const db = track(new Dexie("missing-api", { indexedDB: undefined }));
  await openAccountDatabase(db);
  expect(databaseAccess(db).state).toBe("unavailable");
});
