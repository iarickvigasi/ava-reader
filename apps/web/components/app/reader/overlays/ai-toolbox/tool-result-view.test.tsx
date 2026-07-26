import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { ToolResultView } from "./tool-result-view";

// renderToStaticMarkup escapes apostrophes (we'll → we&#x27;ll), so assert on
// apostrophe-free substrings of the real en.json prose.
function render(props: Parameters<typeof ToolResultView>[0]) {
  return renderToStaticMarkup(withIntl(<ToolResultView {...props} />));
}

describe("ToolResultView", () => {
  it("shows the queued placeholder when offline-queued (no body yet)", () => {
    const markup = render({
      text: "",
      isStreaming: false,
      error: null,
      phase: "queued",
    });
    expect(markup).toContain("Waiting for connection");
    // The streaming placeholder belongs to a different state and must not leak.
    expect(markup).not.toContain("Generating");
  });

  it("shows the server reason inline with a retry when a replay failed", () => {
    const onRetry = vi.fn();
    const markup = render({
      text: "",
      isStreaming: false,
      error: null,
      phase: "failed",
      failureReason: "You are out of credits.",
      onRetry,
    });
    expect(markup).toContain("You are out of credits.");
    expect(markup).toContain("Try again");
  });

  it("falls back to a generic message when a failed comment has no reason", () => {
    const markup = render({
      text: "",
      isStreaming: false,
      error: null,
      phase: "failed",
      failureReason: null,
      onRetry: vi.fn(),
    });
    expect(markup).toContain("Something went wrong.");
  });

  it("prefers the streamed/saved body over any placeholder", () => {
    const markup = render({
      text: "the translated body",
      isStreaming: false,
      error: null,
      // Even if a stale queued phase is passed, a non-empty body wins.
      phase: "queued",
    });
    expect(markup).toContain("the translated body");
    expect(markup).not.toContain("Waiting for connection");
  });

  it("renders a live request error with a retry", () => {
    const markup = render({
      text: "",
      isStreaming: false,
      error: "AI request failed (HTTP 500). Please try again.",
      phase: null,
      onRetry: vi.fn(),
    });
    expect(markup).toContain("AI request failed (HTTP 500). Please try again.");
    expect(markup).toContain("Try again");
  });
});
