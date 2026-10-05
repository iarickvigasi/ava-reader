import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../db";
import { applyCurrentUser, readCurrentUser } from "./storage";
import { persistProfilePatch, readProfileMutation } from "./profile-storage";
import { flushProfile } from "./sync";

vi.mock("../../net/net-state", () => ({ isOnline: () => true }));
vi.mock("../home/revalidate", () => ({
  revalidateHome: vi.fn().mockResolvedValue(undefined),
}));
const user = {
  id: "u",
  clerkUserId: "c",
  email: "private@example.com",
  displayName: "Old",
  role: "DEVELOPER" as const,
  avatarUrl: null,
  telegramUrl: null,
};
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.unstubAllGlobals();
});
it("publishes edits, updates the cache, and clears the acknowledged mutation", async () => {
  await applyCurrentUser(user);
  await persistProfilePatch({
    displayName: "New",
    telegramUrl: "https://t.me/ava_dev",
  });
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      ...user,
      displayName: "New",
      telegramUrl: "https://t.me/ava_dev",
    }),
  );
  vi.stubGlobal("fetch", fetch);
  await flushProfile(async () => "token");
  expect(await readProfileMutation()).toBeNull();
  expect(await readCurrentUser()).toMatchObject({
    displayName: "New",
    telegramUrl: "https://t.me/ava_dev",
  });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    displayName: "New",
    telegramUrl: "https://t.me/ava_dev",
  });
});
it("retains a permanent rejection without retrying endlessly", async () => {
  await applyCurrentUser(user);
  await persistProfilePatch({ displayName: "New", telegramUrl: null });
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  await flushProfile(async () => "token");
  expect(await readProfileMutation()).toMatchObject({ error: true });
  expect((await readCurrentUser())?.displayName).toBe("Old");
  await flushProfile(async () => "token");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("does not send another account's queued edits after a switch during token retrieval", async () => {
  await persistProfilePatch({ displayName: "Private draft" });
  const oldDb = getDb();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await flushProfile(async () => {
    setActiveUser("other");
    return "other-token";
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(await readProfileMutation()).toBeNull();
  await oldDb.delete();
});
