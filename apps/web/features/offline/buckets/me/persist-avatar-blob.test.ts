import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { applyCurrentUser, readAvatarBlob } from "./storage";
import { persistAvatarFromNetwork } from "./persist-avatar-blob";

const user = {
  id: "reader",
  clerkUserId: "clerk",
  email: "a@test.com",
  displayName: "Ada",
  avatarUrl: "https://images.test/ada",
  roles: [],
};
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.restoreAllMocks();
});

it("coalesces concurrent downloads and saves the photo", async () => {
  await applyCurrentUser(user);
  const blob = new Blob(["photo"], { type: "image/png" });
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(blob));
  await Promise.all([
    persistAvatarFromNetwork(user.avatarUrl),
    persistAvatarFromNetwork(user.avatarUrl),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((await readAvatarBlob())?.size).toBe(blob.size);
});

it("discards an old download after the profile photo changes", async () => {
  await applyCurrentUser(user);
  let resolve!: (response: Response) => void;
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const download = persistAvatarFromNetwork(user.avatarUrl);
  await applyCurrentUser({ ...user, avatarUrl: "https://images.test/new" });
  resolve(new Response(new Blob(["old"])));
  await download;
  expect(await readAvatarBlob()).toBeNull();
});

it("invalidates a cached photo when its URL changes", async () => {
  await applyCurrentUser(user);
  await getDb().me.update("me", { avatarBlob: new Blob(["old"]) });
  await applyCurrentUser({ ...user, avatarUrl: null });
  expect(await readAvatarBlob()).toBeNull();
});
