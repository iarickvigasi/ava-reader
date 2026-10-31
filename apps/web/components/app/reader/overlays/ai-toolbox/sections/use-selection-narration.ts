import type { ReaderBookPayload, ReaderChapterPayload } from "@/lib/api-types";
import { selectionNarrationInput } from "@/features/narration/selection-narration-input";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { SelectionPlayer } from "@/features/narration/selection-player";
import { requestNarration } from "@/features/narration/request-narration";
import { useReaderSelectionContext } from "../../../selection/reader-selection-context";

export function useSelectionNarration(
  libraryItemId: string,
  book: ReaderBookPayload,
  chapters: ReaderChapterPayload[],
) {
  const { getToken, userId } = useAuth();
  const selection = useReaderSelectionContext();
  const { text, locator, context } = selection;
  const input = useMemo(
    () => selectionNarrationInput({ book, chapters, text, locator, context }),
    [book, chapters, text, locator, context],
  );
  const selectionKey = JSON.stringify([userId, libraryItemId, locator, input]);
  // A player owns exactly one selection and account, including its temporary audio cache.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const player = useMemo(() => new SelectionPlayer(), [selectionKey]);
  useEffect(() => () => player.dispose(), [player]);
  const state = useSyncExternalStore(
    player.subscribe,
    player.snapshot,
    () => "idle",
  );
  const toggle = () => {
    if (!text?.trim()) return;
    void player.toggle((signal) =>
      requestNarration({ libraryItemId, ...input, getToken, signal }),
    );
  };
  return { state, toggle, disabled: !text?.trim() };
}
