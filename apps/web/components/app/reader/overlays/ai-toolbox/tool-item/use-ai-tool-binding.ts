import { useCallback, useEffect } from "react";
import { generateAiCommentId } from "@/features/offline/buckets/ai-comments";
import { useAiCommentsContext } from "../../ai-comments/ai-comments-context";
import { buildGenerateIntent } from "../generate/build-generate-intent";
import type { SavedComment } from "./saved-comments";
import { deriveToolView } from "./tool-view-model";
import type { AiToolPayload } from "../generate/ai-tool-payload";

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

// All requests enter the durable bucket before any network or token work.
export function useAiToolBinding({
  isOpen,
  payload,
  saved,
}: UseAiToolBindingInput) {
  const { enqueueGenerateIntent } = useAiCommentsContext();
  const start = useCallback(() => {
    if (!payload) return;
    enqueueGenerateIntent(
      buildGenerateIntent(
        payload,
        generateAiCommentId(),
        new Date().toISOString(),
      ),
    );
  }, [payload, enqueueGenerateIntent]);

  useEffect(() => {
    if (isOpen && !saved) start();
  }, [isOpen, saved, start]);

  return {
    ...deriveToolView({ text: "", isStreaming: false, error: null }, saved),
    retry: payload ? start : undefined,
  };
}
