import type { SavedComment } from "./saved-comments";
import type { ToolPhase } from "./tool-result-view";

// The live state surfaced by `useAiTool` (the foreground streaming request).
type LiveToolState = {
  text: string;
  isStreaming: boolean;
  error: string | null;
};

// Everything `ToolResultView` needs to pick a state to render. `retry` is added
// by the binding (it closes over the live request); the rest is pure.
export type ToolView = {
  text: string;
  isStreaming: boolean;
  error: string | null;
  phase: ToolPhase;
  failureReason: string | null;
};

// Pure: combine the live request state with the matched bucket record into the
// view the panel renders.
//
// Streaming wins: a live request OR a bucket record the background sync is
// replaying ("streaming") shows the "Generating…" animation — the connection
// is active in both cases. Only a "queued" record (requested offline, not yet
// sent) shows the "waiting for connection" placeholder. A failed record shows
// its reason; a non-empty body (streamed live, or filled in by the bucket on
// reconnect) always wins over any placeholder.
export function deriveToolView(
  tool: LiveToolState,
  saved: SavedComment | undefined,
): ToolView {
  const text = tool.text || saved?.body || "";
  // A bucket record is "streaming" only while its reconnect replay is in
  // flight — treat that exactly like a live request (animation + caret).
  const isStreaming = tool.isStreaming || saved?.status === "streaming";
  const isActive = isStreaming || text.length > 0 || tool.error !== null;
  const phase: ToolPhase = isActive
    ? null
    : saved?.status === "failed"
      ? "failed"
      : saved?.status === "queued"
        ? "queued"
        : null;
  return {
    text,
    isStreaming,
    error: tool.error,
    phase,
    failureReason: saved?.error ?? null,
  };
}
