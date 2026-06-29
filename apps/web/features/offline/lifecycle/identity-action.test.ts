import { describe, expect, it } from "vitest";

import { decideIdentityAction } from "./identity-action";

describe("decideIdentityAction", () => {
  it("does nothing on a fresh tab with no user", () => {
    expect(decideIdentityAction(null, null)).toEqual({ kind: "none" });
  });

  it("wipes the previous user on sign-out (user → null)", () => {
    expect(decideIdentityAction("user-a", null)).toEqual({
      kind: "wipe",
      userId: "user-a",
    });
  });

  it("does nothing on a same-user reload", () => {
    expect(decideIdentityAction("user-a", "user-a")).toEqual({ kind: "none" });
  });

  it("adopts + purges on an account switch (A → B)", () => {
    expect(decideIdentityAction("user-a", "user-b")).toEqual({
      kind: "adopt",
      userId: "user-b",
    });
  });

  it("adopts + purges on a cold start as a different/unknown user", () => {
    // No persisted marker but a user is signed in: could be a first-ever login
    // OR user B opening the app after A never cleanly signed out. We can't tell,
    // so the safe action is adopt-and-purge.
    expect(decideIdentityAction(null, "user-b")).toEqual({
      kind: "adopt",
      userId: "user-b",
    });
  });
});
