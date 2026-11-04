import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, expect, it } from "vitest";
import { AvaReaderDB, DB_NAME, __resetDbForTests, getDb } from "../db";
import { checkpointRow } from "../buckets/sessions/checkpoint-row-fixture";
import { listPendingSessions } from "../buckets/sessions/list-pending-sessions";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it("indexes existing checkpoint rows without retiring pending or acknowledged time", async () => {
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
  old
    .version(8)
    .stores({ ...stores, sessions: "clientSessionId, libraryItemId, state" });
  await old
    .table("sessions")
    .bulkPut([
      checkpointRow({ clientSessionId: "pending" }),
      checkpointRow({ clientSessionId: "acked", acknowledgedRevision: 2 }),
      checkpointRow({ clientSessionId: "dropped", dropped: true }),
    ]);
  old.close();
  expect(
    (await listPendingSessions()).map((row) => row.clientSessionId),
  ).toEqual(["pending"]);
  expect(await getDb().sessions.count()).toBe(3);
  expect(await getDb().sessions.get("acked")).toMatchObject({
    revision: 2,
    acknowledgedRevision: 2,
    syncState: "acknowledged",
  });
});
