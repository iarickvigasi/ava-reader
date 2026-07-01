import { useEffect, useRef } from "react";
import { generateAiCommentId } from "@/features/offline/buckets/ai-comments";
import { useAiCommentsContext } from "../ai-comments/ai-comments-context";
import { buildGenerateIntent } from "./build-generate-intent";
import type { SavedComment } from "./saved-comments";
import { deriveToolView } from "./tool-view-model";
import { type AiToolPayload, useAiTool } from "./use-ai-tool";

type UseAiToolBindingInput = {
  libraryItemId: string;
  isOpen: boolean;
  selection: string;
  // Memoised by the caller. Null while there's no selection — `start` is
  // skipped and `retry` is undefined in that case.
  payload: AiToolPayload | null;
  // The bucket record for this selection+kind, if one exists.
  saved?: SavedComment;
};

// Wraps `useAiTool` with the side effects every tool in the AI Comments panel
// needs, and derives the view phase the panel renders:
//   1. start a generation when the section opens and no bucket record exists
//      yet (online → stream live; offline → queue the intent for reconnect).
//      A record in any state means the bucket owns the lifecycle — we don't
//      fire a parallel live request, and retry stays user-driven.
//   2. clear local state when the selection clears.
//   3. refetch the AiComments list once a live stream finishes.
export function useAiToolBinding({
  libraryItemId,
  isOpen,
  selection,
  payload,
  saved,
}: UseAiToolBindingInput) {
  const { refetch, enqueueGenerateIntent } = useAiCommentsContext();
  const tool = useAiTool({ libraryItemId });

  useEffect(() => {
    if (!isOpen || !payload) return;
    // A bucket record already exists for this selection+kind — the bucket owns
    // it (queued → streaming → ready on reconnect, or failed). Don't fire a
    // parallel live request; `tool.reset()` clears stale streamed text.
    if (saved) {
      tool.reset();
      return;
    }
    // No record yet. Offline → queue the intent; the sync runner replays it on
    // reconnect and the streamed body appears through the selector-merged path.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueGenerateIntent(
        buildGenerateIntent(
          payload,
          generateAiCommentId(),
          new Date().toISOString(),
        ),
      );
      return;
    }
    tool.start(payload);
    // `tool` is stable across renders; depending on it would re-fire forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, payload, saved, enqueueGenerateIntent]);

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

  return {
    ...deriveToolView(tool, saved),
    retry: payload ? () => tool.start(payload) : undefined,
  };
}
