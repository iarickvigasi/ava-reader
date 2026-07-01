import { describe, expect, it } from "vitest";

import { reduceKick, shouldKickPrimer } from "./trigger";

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

describe("reduceKick", () => {
  it("does not advance the edge while not ready (pre-auth render)", () => {
    // Clerk's isLoaded is false on the first render(s), online from the start.
    const r = reduceKick(false, {
      isLoaded: false,
      isSignedIn: undefined,
      online: true,
    });
    expect(r).toEqual({ lastOnline: false, kick: false });
  });

  it("kicks on the first READY render even after pre-auth renders (cold-load regression)", () => {
    // Simulate the real sequence: pre-auth render (online), then auth resolves.
    const { lastOnline } = reduceKick(false, {
      isLoaded: false,
      isSignedIn: undefined,
      online: true,
    });
    // Edge must still be false here, or the cold-load kick is lost.
    expect(lastOnline).toBe(false);
    const ready1 = reduceKick(lastOnline, {
      isLoaded: true,
      isSignedIn: true,
      online: true,
    });
    expect(ready1.kick).toBe(true);
    expect(ready1.lastOnline).toBe(true);
  });

  it("does not re-kick while staying online", () => {
    const r = reduceKick(true, { ...ready, online: true });
    expect(r).toEqual({ lastOnline: true, kick: false });
  });

  it("re-kicks on an offline→online transition", () => {
    const offline = reduceKick(true, { ...ready, online: false });
    expect(offline).toEqual({ lastOnline: false, kick: false });
    const back = reduceKick(offline.lastOnline, { ...ready, online: true });
    expect(back.kick).toBe(true);
  });
});
