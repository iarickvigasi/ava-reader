import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./copy-text-to-clipboard";

// Vitest runs in a node environment (no jsdom), so `navigator` is stubbed
// per test; unstub so other suites see the real global.
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyTextToClipboard", () => {
  it("writes the text and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("reports failure when the write is rejected (permission, focus)", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await expect(copyTextToClipboard("hello")).resolves.toBe(false);
  });

  it("reports failure when the Clipboard API is missing", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyTextToClipboard("hello")).resolves.toBe(false);
  });
});
