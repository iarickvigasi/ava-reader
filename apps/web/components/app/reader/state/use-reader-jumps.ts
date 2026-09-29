import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import type { JumpHistory } from "@/features/reader/jump-history";
import type { ReadyReaderProps } from "../shared/types";
import { emptyJumpHistory } from "@/features/reader/jump-history";
import { createJumpSession } from "@/features/reader/jump-session";
import { focusReaderPassage } from "./focus-reader-passage";
import { useJumpOrigin } from "./use-jump-origin";
export function useReaderJumps(props: ReadyReaderProps) {
  const [snapshot, publish] = useState(emptyJumpHistory);
  const [error, setError] = useState<string | null>(null);
  const source = useJumpOrigin(props);
  const effects = {
    origin: source.origin,
    navigate: (destination: ReaderLocator, requestId: number) =>
      props.onSelectChapter(destination.chapterId, {
        blockId: destination.blockId || undefined,
        textOffset: destination.textOffset,
        requestId,
      }),
    arrive: source.arrive,
    leave: source.leavePassage,
    focus: focusReaderPassage,
    publish: (state: JumpHistory, message: string | null) => {
      publish(state);
      setError(message);
    },
  };
  const [session] = useState(() => createJumpSession(effects));
  useLayoutEffect(() => {
    session.update(effects);
  });
  useEffect(() => {
    session.activate();
    return session.dispose;
  }, [session]);
  const { visibleChanged: onVisibleLocatorChange } = source;
  const visibleChanged = useCallback(
    (locator: ReaderLocator | null) => {
      if (!session.pending()) onVisibleLocatorChange(locator);
    },
    [session, onVisibleLocatorChange],
  );
  return {
    jump: session.jump,
    back: session.back,
    leavePassage: source.leavePassage,
    settle: session.settle,
    setError,
    error,
    visibleChanged,
    referenceBlockId: snapshot.referenceBlockId,
    canBack: snapshot.entries.length > 0,
    pending: !!snapshot.pending,
  };
}
