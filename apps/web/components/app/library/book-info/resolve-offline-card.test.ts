import { describe, expect, it } from "vitest";

import { resolveOfflineCard } from "./resolve-offline-card";

const base = {
  aborting: false,
  isDownloading: false,
  offlineState: "absent" as const,
  fromAutoSave: false,
  offlineRequested: false,
};

describe("resolveOfflineCard", () => {
  it("idle when nothing is cached or requested", () => {
    expect(resolveOfflineCard(base)).toBe("idle");
  });

  it("idle while Dexie is still resolving", () => {
    expect(resolveOfflineCard({ ...base, offlineState: "loading" })).toBe(
      "idle",
    );
  });

  it("queued when requested but content is absent — survives a remount", () => {
    expect(resolveOfflineCard({ ...base, offlineRequested: true })).toBe(
      "queued",
    );
  });

  it("downloading takes precedence over a queued request", () => {
    expect(
      resolveOfflineCard({
        ...base,
        offlineRequested: true,
        isDownloading: true,
      }),
    ).toBe("downloading");
  });

  it("aborting takes precedence over everything", () => {
    expect(
      resolveOfflineCard({ ...base, aborting: true, isDownloading: true }),
    ).toBe("aborting");
  });

  it("saved for an explicit save that originated from an auto-save", () => {
    expect(
      resolveOfflineCard({
        ...base,
        offlineState: "explicit",
        fromAutoSave: true,
      }),
    ).toBe("saved");
  });

  it("remove for an explicit save downloaded from scratch", () => {
    expect(
      resolveOfflineCard({
        ...base,
        offlineState: "explicit",
        fromAutoSave: false,
      }),
    ).toBe("remove");
  });

  it("keep for an auto-cached book", () => {
    expect(resolveOfflineCard({ ...base, offlineState: "auto" })).toBe("keep");
  });

  it("keep (not queued) when requested but content is already auto-cached", () => {
    // Cross-device synced intent on a book that's only auto-cached here: content
    // is present, so it isn't a pending download — offer to keep it.
    expect(
      resolveOfflineCard({
        ...base,
        offlineState: "auto",
        offlineRequested: true,
      }),
    ).toBe("keep");
  });
});
