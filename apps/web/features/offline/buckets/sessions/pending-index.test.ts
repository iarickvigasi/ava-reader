import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { getDb } from "../../db";
import { trackerFixture } from "./tracker-test-fixture";
import { acknowledgeCheckpoint } from "./acknowledge-checkpoint";
import { checkpointRow } from "./checkpoint-row-fixture";
import { listPendingSessions } from "./list-pending-sessions";

it("keeps newer checkpoints indexed when an older acknowledgment arrives", async () => {
  const f = trackerFixture();
  await f.tracker.start();
  const sent = (await f.rows())[0];
  f.advance(30_000);
  await f.tracker.checkpoint();
  const db = getDb();
  await acknowledgeCheckpoint(db, sent, {
    sessionId: "remote",
    revision: sent.revision,
    durationSeconds: 0,
  });
  expect(await listPendingSessions()).toHaveLength(1);
  const current = (await f.rows())[0];
  await acknowledgeCheckpoint(db, current, {
    sessionId: "remote",
    revision: current.revision,
    durationSeconds: 30,
  });
  expect(await listPendingSessions()).toHaveLength(0);
  f.advance(15_000);
  await f.tracker.stop();
  expect(await listPendingSessions()).toHaveLength(1);
});

it("excludes acknowledged and dropped history without deleting reconciliation evidence", async () => {
  const f = trackerFixture();
  await getDb().sessions.bulkPut([
    checkpointRow({ clientSessionId: "pending" }),
    checkpointRow({ clientSessionId: "acked", acknowledgedRevision: 2 }),
    checkpointRow({ clientSessionId: "dropped", dropped: true }),
  ]);
  expect(
    (await listPendingSessions()).map((row) => row.clientSessionId),
  ).toEqual(["pending"]);
  expect(await f.rows()).toHaveLength(3);
});
