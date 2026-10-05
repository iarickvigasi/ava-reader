import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { applyCurrentUser, readCurrentUser } from "./storage";
import {
  persistProfilePatch,
  readProfileMutation,
  settleProfileMutation,
} from "./profile-storage";

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
});

it("preserves queued edits over server refresh and reload", async () => {
  await applyCurrentUser(user);
  await persistProfilePatch({
    displayName: "New",
    telegramUrl: "https://t.me/ava_dev",
  });
  await applyCurrentUser({ ...user, displayName: "Stale" });
  __resetDbForTests();
  expect(await readCurrentUser()).toMatchObject({
    displayName: "New",
    telegramUrl: "https://t.me/ava_dev",
  });
});
it("does not clear newer edits when an older request completes", async () => {
  await persistProfilePatch({ displayName: "First" });
  const first = (await readProfileMutation())!;
  await persistProfilePatch({ displayName: "Second" });
  await settleProfileMutation(getDb(), first.revision);
  expect((await readProfileMutation())?.patch.displayName).toBe("Second");
});
it("retains rejected drafts and restores the authoritative display", async () => {
  await applyCurrentUser(user);
  await persistProfilePatch({ displayName: "Rejected" });
  const pending = (await readProfileMutation())!;
  await settleProfileMutation(getDb(), pending.revision, true);
  expect((await readCurrentUser())?.displayName).toBe("Old");
  expect(await readProfileMutation()).toMatchObject({
    error: true,
    patch: { displayName: "Rejected" },
  });
});
