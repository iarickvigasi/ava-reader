import { afterEach, expect, it, vi } from "vitest";
import { resourceOwnerIsCurrent } from "./resource-owner";
const session = vi.hoisted(() => ({ owner: "owner-one", signedOut: false }));
vi.mock("@/features/offline/db", () => ({
  getActiveUserId: () => session.owner,
}));
vi.mock("@/features/auth/local-sign-out", () => ({
  isLocallySignedOut: () => session.signedOut,
}));
afterEach(() => {
  vi.unstubAllGlobals();
  session.owner = "owner-one";
  session.signedOut = false;
});
it("requires matching active account, live Clerk owner and no explicit sign-out", () => {
  const clerk = {
    loaded: true,
    user: { id: "owner-one" },
    session: { id: "session-one" },
  };
  vi.stubGlobal("window", { Clerk: clerk });
  expect(resourceOwnerIsCurrent("owner-one")).toBe(true);
  session.signedOut = true;
  expect(resourceOwnerIsCurrent("owner-one")).toBe(false);
  session.signedOut = false;
  session.owner = "owner-two";
  expect(resourceOwnerIsCurrent("owner-one")).toBe(false);
  session.owner = "owner-one";
  clerk.user.id = "owner-two";
  expect(resourceOwnerIsCurrent("owner-one")).toBe(false);
  clerk.user.id = "owner-one";
  clerk.loaded = false;
  expect(resourceOwnerIsCurrent("owner-one")).toBe(false);
});
