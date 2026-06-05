import { describe, expect, it } from "vitest";

import { deriveStatus } from "./context";

describe("BookContext deriveStatus", () => {
  it("returns 'hydrating' until the cache check resolves", () => {
    expect(
      deriveStatus({ hasCached: null, online: true, saveStatus: "idle" }),
    ).toBe("hydrating");
    expect(
      deriveStatus({ hasCached: null, online: false, saveStatus: "idle" }),
    ).toBe("hydrating");
  });

  it("returns 'ready' when the book is in cache, regardless of network", () => {
    expect(
      deriveStatus({ hasCached: true, online: true, saveStatus: "idle" }),
    ).toBe("ready");
    expect(
      deriveStatus({ hasCached: true, online: false, saveStatus: "idle" }),
    ).toBe("ready");
  });

  it("returns 'saving' when not cached but currently downloading", () => {
    expect(
      deriveStatus({
        hasCached: false,
        online: true,
        saveStatus: "saving",
      }),
    ).toBe("saving");
  });

  it("returns 'missing-offline' when not cached and offline", () => {
    expect(
      deriveStatus({
        hasCached: false,
        online: false,
        saveStatus: "idle",
      }),
    ).toBe("missing-offline");
  });

  it("returns 'saving' (about to fire) when not cached, online, and idle", () => {
    // The provider's effect will kick off a save in the next tick; the
    // status presents as 'saving' to avoid a one-frame flash of
    // missing-offline UI between cache-check resolving and save effect.
    expect(
      deriveStatus({
        hasCached: false,
        online: true,
        saveStatus: "idle",
      }),
    ).toBe("saving");
  });

  it("returns 'failed' when a previous save attempt errored out", () => {
    expect(
      deriveStatus({
        hasCached: false,
        online: true,
        saveStatus: "failed",
      }),
    ).toBe("failed");
  });
});
