import { describe, expect, it } from "vitest";

import { shouldKickPrimer } from "./trigger";

const ready = { isLoaded: true, isSignedIn: true };

describe("shouldKickPrimer", () => {
  it("runs when we become online (first render: wasOnline starts false)", () => {
    expect(
      shouldKickPrimer({ ...ready, wasOnline: false, online: true }),
    ).toBe(true);
  });

  it("does not run while staying online — no transition, no re-kick", () => {
    expect(
      shouldKickPrimer({ ...ready, wasOnline: true, online: true }),
    ).toBe(false);
  });

  it("does not run while offline", () => {
    expect(
      shouldKickPrimer({ ...ready, wasOnline: true, online: false }),
    ).toBe(false);
    expect(
      shouldKickPrimer({ ...ready, wasOnline: false, online: false }),
    ).toBe(false);
  });

  it("waits for auth: no run until loaded and signed in", () => {
    expect(
      shouldKickPrimer({
        isLoaded: false,
        isSignedIn: true,
        wasOnline: false,
        online: true,
      }),
    ).toBe(false);
    expect(
      shouldKickPrimer({
        isLoaded: true,
        isSignedIn: false,
        wasOnline: false,
        online: true,
      }),
    ).toBe(false);
  });

  it("treats an unresolved sign-in state (Clerk undefined) as not ready", () => {
    expect(
      shouldKickPrimer({
        isLoaded: true,
        isSignedIn: undefined,
        wasOnline: false,
        online: true,
      }),
    ).toBe(false);
  });
});
