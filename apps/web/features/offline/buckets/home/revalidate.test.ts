import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AvaReaderDB, getDb, __resetDbForTests, setActiveUser } from "../../db";
import { recordCompletionAck } from "../../completion/state";
import { deferredResponse } from "../library/finish-date/test-fixture";
import { applyHome, readHome } from "./storage";
import { revalidateHome } from "./revalidate";
import { finishDate, homeFixture, trackedId } from "./test-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  await applyHome(homeFixture());
});
afterEach(() => {
  __resetDbForTests();
  vi.unstubAllGlobals();
});

it("rejects an aggregate GET that started before a different tab acknowledged completion", async () => {
  const response = deferredResponse();
  vi.stubGlobal("fetch", vi.fn(response.fetch));
  const otherTab = new AvaReaderDB(getDb().name);
  await otherTab.open();
  try {
    const request = revalidateHome(async () => "token");
    await response.started;
    await otherTab.transaction("rw", otherTab.meta, () => recordCompletionAck(otherTab, trackedId, { finishedAt: finishDate }));
    const stale = homeFixture();
    stale.user.displayName = "Stale response";
    response.respond(Response.json(stale));
    await request;
    expect((await readHome())?.stats.volumesRead).toBe(4);
    expect((await getDb().home.get("me"))?.payload.user.displayName).toBe("Reader");
  } finally {
    otherTab.close();
  }
});

it("does not write an old account's home response into the new account", async () => {
  const response = deferredResponse();
  vi.stubGlobal("fetch", vi.fn(response.fetch));
  const request = revalidateHome(async () => "old-token");
  await response.started;
  setActiveUser("home-other-account");
  await getDb().delete();
  await getDb().open();
  const other = homeFixture();
  other.user.displayName = "Other account";
  await applyHome(other);
  response.respond(Response.json(homeFixture()));
  await request;
  expect((await readHome())?.user.displayName).toBe("Other account");
  await getDb().delete();
});
