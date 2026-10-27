import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { cacheDeveloperAvatar } from "./developer-avatars";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.restoreAllMocks();
});

it("persists developer bytes and reuses them without another download", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(new Blob(["photo"])));
  await Promise.all([
    cacheDeveloperAvatar("ada", "https://images.test/ada"),
    cacheDeveloperAvatar("ada", "https://images.test/ada"),
  ]);
  await cacheDeveloperAvatar("ada", "https://images.test/ada");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const row = await getDb().meta.get("developer-avatar:ada");
  expect((row?.value as { blob: Blob }).blob.size).toBe(5);
});

it("keeps the last good photo when refreshing fails offline", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(new Blob(["photo"])))
    .mockRejectedValueOnce(new TypeError("offline"));
  await cacheDeveloperAvatar("ada", "https://images.test/ada");
  await cacheDeveloperAvatar("ada", "https://images.test/new");
  const row = await getDb().meta.get("developer-avatar:ada");
  expect((row?.value as { url: string }).url).toBe("https://images.test/ada");
});
