import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { applyCurrentUser, readCurrentUser } from "./storage";
import { persistProfilePatch, readProfileMutation } from "./profile-storage";
import { persistConnectDraft, readConnectDraft } from "./connect-draft-storage";
import { flushProfile } from "./sync";

vi.mock("../../net/net-state", () => ({ isOnline: () => true }));
vi.mock("../home/revalidate", () => ({
  revalidateHome: vi.fn().mockResolvedValue(undefined),
}));
const user = {
  id: "u",
  clerkUserId: "c",
  email: "private@example.test",
  displayName: "Reader",
  roles: [],
  avatarUrl: null,
};
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.unstubAllGlobals();
});

it("syncs a published profile and then hides it without losing saved fields", async () => {
  await applyCurrentUser(user);
  await persistConnectDraft({
    introduction: "A curious reader",
    shareCurrentBook: true,
  });
  const patch = {
    introduction: "A curious reader",
    profilePublished: true,
    shareCurrentBook: true,
  };
  await persistProfilePatch(patch);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ ...user, ...patch }))
    .mockResolvedValueOnce(
      Response.json({ ...user, ...patch, profilePublished: false }),
    );
  vi.stubGlobal("fetch", fetch);
  await flushProfile(async () => "token");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(patch);
  expect(await readCurrentUser()).toMatchObject(patch);
  expect(await readConnectDraft()).toBeNull();
  expect(await readProfileMutation()).toBeNull();
  await persistProfilePatch({ profilePublished: false });
  await flushProfile(async () => "token");
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
    profilePublished: false,
  });
  expect(await readCurrentUser()).toMatchObject({
    ...patch,
    profilePublished: false,
  });
});
