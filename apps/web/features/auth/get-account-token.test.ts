import { afterEach, expect, it, vi } from "vitest";
import { getAccountToken } from "./get-account-token";

const identity = vi.hoisted(() => ({ owner: "a", blocked: false }));
vi.mock("@/features/offline/db", () => ({
  getActiveUserId: () => identity.owner,
  ACTIVE_USER_STORAGE_KEY: "owner",
}));
vi.mock("./local-sign-out", () => ({
  isLocallySignedOut: () => identity.blocked,
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  identity.owner = "a";
  identity.blocked = false;
});
function browser(loaded = true, user = "a") {
  vi.stubGlobal("navigator", { onLine: true });
  const clerk = { loaded, user: { id: user }, session: { id: "session" } };
  vi.stubGlobal("window", {
    Clerk: clerk,
    localStorage: { getItem: () => identity.owner },
  });
  return clerk;
}
it("does not wait for an uninitialized Clerk runtime", async () => {
  browser(false);
  const getToken = vi.fn();
  expect(await getAccountToken("a", getToken)).toBeNull();
  expect(getToken).not.toHaveBeenCalled();
});
it("times out a stalled token and allows the next attempt", async () => {
  browser();
  vi.useFakeTimers();
  const first = getAccountToken("a", () => new Promise(() => {}));
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await first).toBeNull();
  expect(await getAccountToken("a", async () => "token")).toBe("token");
});
it("rejects an old account closure before calling Clerk", async () => {
  browser(true, "b");
  const getToken = vi.fn();
  expect(await getAccountToken("a", getToken)).toBeNull();
  expect(getToken).not.toHaveBeenCalled();
});
it("discards a token when account ownership changes during refresh", async () => {
  browser();
  let finish!: (token: string) => void;
  const work = getAccountToken(
    "a",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  identity.owner = "b";
  finish("token");
  expect(await work).toBeNull();
});
it("explicit sign-out blocks a still-valid provider session", async () => {
  browser();
  identity.blocked = true;
  expect(await getAccountToken("a", async () => "token")).toBeNull();
});
it("a rejected refresh preserves retryability", async () => {
  browser();
  expect(
    await getAccountToken("a", async () => {
      throw new Error("offline");
    }),
  ).toBeNull();
  expect(await getAccountToken("a", async () => "renewed")).toBe("renewed");
});
