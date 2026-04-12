"use client";

import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";
import { ReadyReader } from "./reader-screen/screen/ready-reader";
import { ReaderStatusState } from "./reader-screen/screen/reader-status-state";
import {
  READER_PERSISTENCE_MODE_REMOTE,
  READER_STATUS_READY,
} from "./reader-screen/shared/constants";
import type { ReaderScreenProps } from "./reader-screen/shared/types";
import { roundFontScale } from "./reader-screen/shared/utils";
import { useReaderScreenController } from "./reader-screen/state/use-reader-screen-controller";

export function ReaderScreen({
  initialPayload,
  libraryItemId,
  persistenceMode = READER_PERSISTENCE_MODE_REMOTE,
}: ReaderScreenProps) {
  const [fontScale, setFontScale] = useState(1);
  const {
    activeChapter,
    displayLocator,
    isBootstrapping,
    isLoadingChapter,
    isRefreshingWindow,
    navigateToChapter,
    payload,
    pendingChapterId,
    restoreIntent,
    setVisibleLocator,
    visibleLocator,
  } = useReaderScreenController({
    initialPayload,
    libraryItemId,
    persistenceMode,
  });
  const isReaderReady = payload.status === READER_STATUS_READY;

  const handleDecreaseFont = useCallback(() => {
    setFontScale((current) => Math.max(0.85, roundFontScale(current - 0.1)));
  }, []);

  const handleIncreaseFont = useCallback(() => {
    setFontScale((current) => Math.min(1.35, roundFontScale(current + 0.1)));
  }, []);

  const readerStyle = useMemo(
    () =>
      ({
        "--reader-font-scale": fontScale,
      }) as CSSProperties,
    [fontScale],
  );

  return (
    <div className="bg-paper text-ink" style={readerStyle}>
      <div className="mx-auto min-h-screen max-w-375 md:pl-20">
        {!isReaderReady ? (
          <ReaderStatusState payload={payload} />
        ) : activeChapter ? (
          <ReadyReader
            activeChapter={activeChapter}
            displayLocator={displayLocator}
            fontScale={fontScale}
            isBootstrapping={isBootstrapping}
            isLoadingChapter={isLoadingChapter}
            isRefreshingWindow={isRefreshingWindow}
            libraryItemId={libraryItemId}
            onDecreaseFont={handleDecreaseFont}
            onIncreaseFont={handleIncreaseFont}
            onSelectChapter={navigateToChapter}
            onVisibleLocatorChange={setVisibleLocator}
            payload={payload}
            pendingChapterId={pendingChapterId}
            restoreIntent={restoreIntent}
            visibleLocator={visibleLocator}
          />
        ) : null}
      </div>
    </div>
  );
}
