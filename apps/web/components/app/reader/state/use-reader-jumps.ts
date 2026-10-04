import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import type { JumpHistory } from "@/features/reader/jump-history";
import type { ReadyReaderProps } from "../shared/types";
import { emptyJumpHistory } from "@/features/reader/jump-history";
import { createJumpSession } from "@/features/reader/jump-session";
import { focusReaderPassage } from "./focus-reader-passage";
import { resolveJumpTarget } from "@/features/reader/jump-target";
import { useNavigationQa } from "@/features/reader/navigation-qa/use-navigation-qa";
import { useJumpScope } from "./use-jump-scope";
import { useJumpOrigin } from "./use-jump-origin";
export function useReaderJumps(props: ReadyReaderProps) {
  const [snapshot, publish] = useState(emptyJumpHistory);
  const [error, setError] = useState<string | null>(null);
  const source = useJumpOrigin(props);
  const scope = useJumpScope(props);
  const qa = useNavigationQa();
  const effects = {
    scope,
    origin: source.origin,
    navigate: (destination: ReaderLocator, requestId: number) =>
      props.onSelectChapter(destination.chapterId, {
        blockId: destination.blockId || undefined,
        textOffset: destination.textOffset,
        requestId,
      }),
    resolve: (target: ReaderLocator) => {
      const chapter = props.payload.chapters.find(
        (item) => item.chapterId === target.chapterId,
      );
      const resolved = chapter && resolveJumpTarget(chapter, target);
      return resolved ? { ...target, ...resolved } : null;
    },
    arrive: source.arrive,
    leave: source.leavePassage,
    focus: focusReaderPassage,
    publish: (state: JumpHistory, message: string | null) => {
      publish(state);
      setError(message);
    },
  };
  const [session] = useState(() =>
    createJumpSession(qa?.wrap(effects) ?? effects),
  );
  useLayoutEffect(() => {
    qa?.bind(
      session,
      scope,
      props.payload.chapters.map((chapter) => chapter.chapterId),
    );
    session.update(qa?.wrap(effects) ?? effects);
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
    settle: qa?.settle ?? session.settle,
    setError,
    error,
    visibleChanged,
    referenceBlockId: snapshot.referenceBlockId,
    canBack: snapshot.entries.length > 0,
    pending: !!snapshot.pending,
  };
}
