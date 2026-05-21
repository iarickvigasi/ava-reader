import { useEffect, useRef } from "react";
import { useAiCommentsContext } from "../ai-comments/ai-comments-context";
import { type AiToolPayload, useAiTool } from "./use-ai-tool";

type UseAiToolBindingInput = {
  libraryItemId: string;
  isOpen: boolean;
  selection: string;
  // Memoised by the caller. Null while there's no selection — `start` is
  // skipped and `retry` is undefined in that case.
  payload: AiToolPayload | null;
};

// Wraps `useAiTool` with the three side effects every tool in the AI Comments
// panel needs:
//   1. start a generation when its section is open and a payload exists
//   2. clear local state when the selection clears
//   3. refetch the AiComments list once a stream finishes (the server persists
//      the row in onFinish, so by the time isStreaming flips false the row is
//      in the DB).
export function useAiToolBinding({
  libraryItemId,
  isOpen,
  selection,
  payload,
}: UseAiToolBindingInput) {
  const { refetch } = useAiCommentsContext();
  const tool = useAiTool({ libraryItemId });

  useEffect(() => {
    if (!isOpen || !payload) return;
    tool.start(payload);
    // `tool` is stable across renders; depending on it would re-fire forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, payload]);

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
    text: tool.text,
    isStreaming: tool.isStreaming,
    error: tool.error,
    retry: payload ? () => tool.start(payload) : undefined,
  };
}
