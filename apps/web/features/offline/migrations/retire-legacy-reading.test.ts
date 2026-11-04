import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, expect, it } from "vitest";
import {
  AvaReaderDB,
  DB_NAME,
  SCHEMA_VERSION,
  __resetDbForTests,
  getDb,
} from "../db";
import { homeFixture } from "../buckets/home/test-fixture";
import { hasPendingChanges } from "@/features/auth/has-pending-changes";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it("retires legacy time and unused stores while preserving checkpoints and server history", async () => {
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
  old.version(7).stores({
    ...stores,
    sessions: "clientSessionId, libraryItemId, state, syncedAt",
    statsSnapshot: "id",
    sessionMutations: "mutationId, scopeId, queuedAt, clientSessionId",
  });
  const home = { id: "me", payload: homeFixture(), fetchedAt: "before" };
  const checkpoint = {
    clientSessionId: "checkpoint",
    libraryItemId: "book",
    trackingVersion: 2,
    revision: 3,
    acknowledgedRevision: 2,
    state: "closed",
    timeZone: "UTC",
    startedAt: "2026-11-03T12:00:00Z",
    lastHeartbeatAt: "2026-11-03T12:05:00Z",
    endedAt: "2026-11-03T12:05:00Z",
  };
  await old.table("sessions").bulkPut([
    { clientSessionId: "legacy-pending", state: "closed", syncedAt: null },
    { clientSessionId: "legacy-acked", syncedAt: "before" },
    {
      ...checkpoint,
      serverSessionId: "server",
      syncedAt: "before",
      replayStatus: "acknowledged",
    },
    { ...checkpoint, clientSessionId: "rejected", replayStatus: "dropped" },
  ]);
  await old.table("sessionMutations").put({ mutationId: "unused" });
  await old.table("statsSnapshot").put({ id: "me", payload: {} });
  await old.table("home").put(home);
  old.close();

  const db = getDb();
  await db.open();
  expect(db.verno).toBe(SCHEMA_VERSION);
  expect(db.tables.map((table) => table.name)).not.toContain("statsSnapshot");
  expect(db.tables.map((table) => table.name)).not.toContain(
    "sessionMutations",
  );
  expect(await db.sessions.toArray()).toEqual([
    { ...checkpoint, syncState: "pending" },
    {
      ...checkpoint,
      clientSessionId: "rejected",
      dropped: true,
      syncState: "dropped",
    },
  ]);
  expect(await db.home.get("me")).toEqual(home);
  expect(await hasPendingChanges()).toBe(true);
  await db.sessions.update("checkpoint", { acknowledgedRevision: 3 });
  expect(await hasPendingChanges()).toBe(false);
});
