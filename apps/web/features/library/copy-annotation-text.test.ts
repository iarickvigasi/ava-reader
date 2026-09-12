import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "@/lib/copy-text-to-clipboard";
import { emitAppToast } from "@/components/app/core/app-toast";
import { copyAnnotationText } from "./copy-annotation-text";

vi.mock("@/lib/copy-text-to-clipboard", () => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/components/app/core/app-toast", () => ({ emitAppToast: vi.fn() }));
const messages = { success: "Highlights copied", failure: "Couldn’t copy. Please try again." };
beforeEach(() => vi.clearAllMocks());

describe("copyAnnotationText", () => {
  it("shows success only after the full clipboard write completes", async () => {
    let finish!: (copied: boolean) => void;
    vi.mocked(copyTextToClipboard).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const pending = copyAnnotationText("Full source.\n\nFull response.", messages);
    expect(copyTextToClipboard).toHaveBeenCalledWith("Full source.\n\nFull response.");
    expect(emitAppToast).not.toHaveBeenCalled();
    finish(true);
    await pending;
    expect(emitAppToast).toHaveBeenCalledExactlyOnceWith({ message: messages.success, tone: "info" });
  });

  it("shows the localized error when clipboard writing fails", async () => {
    vi.mocked(copyTextToClipboard).mockResolvedValue(false);
    await copyAnnotationText("Passage", messages);
    expect(emitAppToast).toHaveBeenCalledExactlyOnceWith({ message: messages.failure, tone: "error" });
  });
});
