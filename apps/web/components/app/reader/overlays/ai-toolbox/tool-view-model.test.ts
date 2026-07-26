import { describe, expect, it } from "vitest";
import type { SavedComment } from "./saved-comments";
import { deriveToolView } from "./tool-view-model";

const idle = { text: "", isStreaming: false, error: null };

function saved(partial: Partial<SavedComment>): SavedComment {
  return { body: "", status: "queued", error: null, ...partial };
}

describe("deriveToolView", () => {
  it("no record + idle tool → nothing to show", () => {
    const view = deriveToolView(idle, undefined);
    expect(view).toMatchObject({ text: "", phase: null });
  });

  it("online fresh request (live stream, no record yet) → generating, no placeholder", () => {
    const streaming = { text: "", isStreaming: true, error: null };
    const view = deriveToolView(streaming, undefined);
    expect(view.phase).toBeNull();
    expect(view.isStreaming).toBe(true);
  });

  it("queued record with no body → queued placeholder", () => {
    const view = deriveToolView(idle, saved({ status: "queued" }));
    expect(view.phase).toBe("queued");
    expect(view.text).toBe("");
  });

  it("streaming record (reconnect replay in flight), no body → generating, not the offline placeholder", () => {
    const view = deriveToolView(idle, saved({ status: "streaming" }));
    // The connection is back: show "Generating…" (phase null + streaming),
    // never the "waiting for connection" placeholder.
    expect(view.phase).toBeNull();
    expect(view.isStreaming).toBe(true);
  });

  it("reconnect fills the body → body wins over the placeholder", () => {
    const view = deriveToolView(
      idle,
      saved({ status: "streaming", body: "Bonjour" }),
    );
    expect(view.phase).toBeNull();
    expect(view.text).toBe("Bonjour");
  });

  it("failed record → failed phase carrying the server reason", () => {
    const view = deriveToolView(
      idle,
      saved({ status: "failed", error: "No credits left." }),
    );
    expect(view.phase).toBe("failed");
    expect(view.failureReason).toBe("No credits left.");
  });

  it("ready record → shows the persisted body, no phase", () => {
    const view = deriveToolView(idle, saved({ status: "ready", body: "hi" }));
    expect(view.phase).toBeNull();
    expect(view.text).toBe("hi");
  });

  it("a live request in flight overrides any saved placeholder", () => {
    const streaming = { text: "stream", isStreaming: true, error: null };
    const view = deriveToolView(streaming, saved({ status: "queued" }));
    expect(view.phase).toBeNull();
    expect(view.text).toBe("stream");
    expect(view.isStreaming).toBe(true);
  });

  it("a live error overrides the queued placeholder", () => {
    const errored = { text: "", isStreaming: false, error: "Boom" };
    const view = deriveToolView(errored, saved({ status: "queued" }));
    expect(view.phase).toBeNull();
    expect(view.error).toBe("Boom");
  });
});
