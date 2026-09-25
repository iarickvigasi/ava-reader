import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { deferredResponse } from "../library/finish-date/test-fixture";
import { applyHome } from "./storage";
import { revalidateHome } from "./revalidate";
import { homeFixture } from "./test-fixture";

const clock = vi.hoisted(() => ({ zone: "Europe/Belgrade" }));
vi.mock("../../stats/device-time-zone", () => ({
  deviceTimeZone: () => clock.zone,
}));
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.unstubAllGlobals();
});

it("sends the device timezone and rejects a late response after travel", async () => {
  await applyHome(homeFixture());
  const response = deferredResponse();
  const fetch = vi.fn<typeof globalThis.fetch>(response.fetch);
  vi.stubGlobal("fetch", fetch);
  const request = revalidateHome(async () => "token");
  await response.started;
  expect(fetch.mock.calls[0][0]).toContain("timeZone=Europe%2FBelgrade");
  clock.zone = "America/Los_Angeles";
  const stale = homeFixture();
  stale.user.displayName = "Stale timezone";
  response.respond(Response.json(stale));
  await request;
  expect((await getDb().home.get("me"))?.payload.user.displayName).toBe(
    "Reader",
  );
});
