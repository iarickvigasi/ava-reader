import { useEffect, useRef } from "react";
import { generateAiCommentId } from "@/features/offline/buckets/ai-comments";
import type { ReaderRangeLocator } from "@/lib/api-types";
import { useAiCommentsContext } from "../ai-comments/ai-comments-context";
import { type AiToolPayload, useAiTool } from "./use-ai-tool";

// The payload's `locator` is a JSON-serialised string (the server's wire
// format). The bucket stores a parsed ReaderRangeLocator so the reader's
// underline-applier can target the range immediately without re-parsing.
function parseLocator(raw: string | undefined): ReaderRangeLocator | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReaderRangeLocator;
  } catch {
    return null;
  }
}

type UseAiToolBindingInput = {
  libraryItemId: string;
  isOpen: boolean;
  selection: string;
  // Memoised by the caller. Null while there's no selection — `start` is
  // skipped and `retry` is undefined in that case.
  payload: AiToolPayload | null;
  // If a prior AI comment of this kind already exists for the current
  // selection, the parent passes the persisted body here. We surface it
  // verbatim and skip the auto-`start` so reopening the panel doesn't
  // re-bill a generation. Retry still re-streams on demand.
  savedText?: string;
};

// Wraps `useAiTool` with the three side effects every tool in the AI Comments
// panel needs:
//   1. start a generation when its section is open and a payload exists
//      (skipped when `savedText` is provided — the previous result stands in)
//   2. clear local state when the selection clears
//   3. refetch the AiComments list once a stream finishes (the server persists
//      the row in onFinish, so by the time isStreaming flips false the row is
//      in the DB).
export function useAiToolBinding({
  libraryItemId,
  isOpen,
  selection,
  payload,
  savedText,
}: UseAiToolBindingInput) {
  const { refetch, enqueueGenerateIntent } = useAiCommentsContext();
  const tool = useAiTool({ libraryItemId });

  useEffect(() => {
    if (!isOpen || !payload) return;
    // A saved body for this selection+kind is already on the server — display
    // it instead of re-generating. `tool.reset()` makes sure stale streamed
    // text from a previous selection doesn't bleed through.
    if (savedText) {
      tool.reset();
      return;
    }
    // when offline, drop the request into the bucket's queue
    // instead of trying the network. The sync runner will replay it once
    // we're back online and the streamed body will appear in the panel
    // through the same selector-merged path. Online path is unchanged.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const id = generateAiCommentId();
      const queuedAt = new Date().toISOString();
      const locator = parseLocator(payload.locator);
      if (payload.kind === "translate") {
        enqueueGenerateIntent({
          kind: "generate.translate",
          id,
          payload: {
            text: payload.text,
            targetLang: payload.targetLang,
            locator: payload.locator,
          },
          locator,
          queuedAt,
        });
      } else if (payload.kind === "etymology") {
        enqueueGenerateIntent({
          kind: "generate.etymology",
          id,
          payload: { text: payload.text, locator: payload.locator },
          locator,
          queuedAt,
        });
      } else {
        enqueueGenerateIntent({
          kind: "generate.explain",
          id,
          payload: {
            text: payload.text,
            context: payload.context,
            bookTitle: payload.bookTitle,
            author: payload.author,
            locator: payload.locator,
          },
          locator,
          queuedAt,
        });
      }
      return;
    }
    tool.start(payload);
    // `tool` is stable across renders; depending on it would re-fire forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, payload, savedText, enqueueGenerateIntent]);

  useEffect(() => {
    if (!selection) tool.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !tool.isStreaming && tool.text) {
      refetch();
    }
    wasStreaming.current = tool.isStreaming;
  }, [tool.isStreaming, tool.text, refetch]);

  // Prefer freshly streamed text once it starts arriving; fall back to the
  // persisted body otherwise. The result: a tool opened with a saved result
  // shows it instantly, and a manual retry transparently overwrites.
  const displayText = tool.text || savedText || "";

  return {
    text: displayText,
    isStreaming: tool.isStreaming,
    error: tool.error,
    retry: payload ? () => tool.start(payload) : undefined,
  };
}
