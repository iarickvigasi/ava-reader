import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { SelectionPlayer, type NarrationState } from "./selection-player";
import type { NarrationInput } from "./selection-narration-input";
import { requestNarration } from "./request-narration";

export function useTextNarration({
  libraryItemId,
  input,
  scope,
}: {
  libraryItemId: string;
  input: NarrationInput;
  scope: string;
}) {
  const { getToken, userId } = useAuth();
  const key = JSON.stringify([userId, libraryItemId, scope, input]);
  // One player and temporary audio cache per account, content and panel scope.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const player = useMemo(() => new SelectionPlayer(), [key]);
  useEffect(() => () => player.dispose(), [player]);
  const state = useSyncExternalStore(
    player.subscribe,
    player.snapshot,
    (): NarrationState => "idle",
  );
  const tooLong = input.text.length > 2048;
  const disabled = !input.text.trim() || tooLong;
  const toggle = () => {
    if (disabled) return;
    void player.toggle((signal) =>
      requestNarration({ libraryItemId, ...input, getToken, signal }),
    );
  };
  return { state: tooLong ? ("too-long" as const) : state, toggle, disabled };
}
