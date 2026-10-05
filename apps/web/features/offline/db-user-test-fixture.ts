import "fake-indexeddb/auto";
import { afterEach, beforeEach } from "vitest";
import { __resetDbForTests } from "./db";

export const anyUser = () => ({
  id: "u",
  clerkUserId: "c",
  email: "x@y.z",
  displayName: "X",
  avatarUrl: null,
  roles: [],
});
async function reset() {
  __resetDbForTests();
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs
      .map((db) => db.name)
      .filter((name): name is string => Boolean(name))
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
  );
}
beforeEach(reset);
afterEach(reset);
