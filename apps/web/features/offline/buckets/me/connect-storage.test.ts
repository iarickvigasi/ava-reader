import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../db";
import { applyCurrentUser, readCurrentUser } from "./storage";
import {
  persistProfilePatch,
  readProfileMutation,
  settleProfileMutation,
} from "./profile-storage";
import {
  persistConnectDraft,
  readConnectDraft,
  settleConnectDraft,
} from "./connect-draft-storage";

const user = {
  id: "u",
  clerkUserId: "c",
  email: "private@test.com",
  displayName: "Reader",
  roles: [],
  avatarUrl: null,
};
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it("merges simultaneous independent name and social edits across reload and refresh", async () => {
  await applyCurrentUser(user);
  await Promise.all([
    persistProfilePatch({ displayName: "New name" }),
    persistProfilePatch({
      introduction: "A reader",
      profilePublished: true,
      shareCurrentBook: true,
    }),
  ]);
  await applyCurrentUser(user);
  __resetDbForTests();
  expect(await readCurrentUser()).toMatchObject({
    displayName: "New name",
    introduction: "A reader",
    profilePublished: true,
    shareCurrentBook: true,
  });
});
it("coalesces publish then hide while retaining the introduction", async () => {
  await persistProfilePatch({
    introduction: "A reader",
    profilePublished: true,
    shareCurrentBook: true,
  });
  const first = (await readProfileMutation())!;
  await persistProfilePatch({ profilePublished: false });
  await settleProfileMutation(getDb(), first.revision);
  expect((await readProfileMutation())?.patch).toEqual({
    introduction: "A reader",
    profilePublished: false,
    shareCurrentBook: true,
  });
});
it("preserves local drafts across reload and an older acknowledgement, then clears matching saved drafts", async () => {
  await persistConnectDraft({ introduction: "Older", shareCurrentBook: false });
  __resetDbForTests();
  expect(await readConnectDraft()).toEqual({
    introduction: "Older",
    shareCurrentBook: false,
  });
  await persistConnectDraft({ introduction: "Newer", shareCurrentBook: true });
  await settleConnectDraft(getDb(), {
    introduction: "Older",
    shareCurrentBook: false,
  });
  expect((await readConnectDraft())?.introduction).toBe("Newer");
  await settleConnectDraft(getDb(), {
    introduction: "Newer",
    shareCurrentBook: true,
  });
  expect(await readConnectDraft()).toBeNull();
});
it("keeps drafts scoped to the active account", async () => {
  await persistConnectDraft({
    introduction: "Private draft",
    shareCurrentBook: false,
  });
  const oldDb = getDb();
  setActiveUser("other");
  expect(await readConnectDraft()).toBeNull();
  await oldDb.delete();
});
it("restores authoritative publication after a permanent rejection while preserving the draft", async () => {
  await applyCurrentUser(user);
  await persistConnectDraft({ introduction: "Draft", shareCurrentBook: false });
  await persistProfilePatch({ introduction: "Draft", profilePublished: true });
  const pending = (await readProfileMutation())!;
  await settleProfileMutation(getDb(), pending.revision, true);
  expect((await readCurrentUser())?.profilePublished ?? false).toBe(false);
  expect((await readConnectDraft())?.introduction).toBe("Draft");
});
