"use client";

import type { CSSProperties } from "react";
import { useCallback, useMemo } from "react";
import {
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  useFontScale,
} from "@/components/app/preferences/use-font-scale";
import { BookContextProvider } from "@/features/offline/buckets/book/context";
import { AiCommentsProvider } from "./overlays/ai-comments/ai-comments-context";
import { HighlightsProvider } from "./overlays/highlights/highlights-context";
import { ReadyReader } from "./view/ready-reader";
import { ReaderSelectionProvider } from "./selection/reader-selection-context";
import { ReaderStatusState } from "./view/reader-status-state";
import {
  READER_PERSISTENCE_MODE_REMOTE,
  READER_STATUS_READY,
} from "./shared/constants";
import type { ReaderScreenProps } from "./shared/types";
import { roundFontScale } from "./shared/utils";
import { useReaderScreenController } from "./state/use-reader-screen-controller";

export function ReaderScreen({
  initialPayload,
  libraryItemId,
  persistenceMode = READER_PERSISTENCE_MODE_REMOTE,
}: ReaderScreenProps) {
  const [fontScale, setFontScale] = useFontScale();
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
    setFontScale(Math.max(MIN_FONT_SCALE, roundFontScale(fontScale - 0.1)));
  }, [fontScale, setFontScale]);

  const handleIncreaseFont = useCallback(() => {
    setFontScale(Math.min(MAX_FONT_SCALE, roundFontScale(fontScale + 0.1)));
  }, [fontScale, setFontScale]);

  const readerStyle = useMemo(
    () =>
      ({
        "--reader-font-scale": fontScale,
      }) as CSSProperties,
    [fontScale],
  );

  return (
    <BookContextProvider libraryItemId={libraryItemId}>
    <div className="h-full bg-paper text-ink" style={readerStyle}>
      <div className="mx-auto h-full max-w-375 overflow-hidden md:pl-20">
        {!isReaderReady ? (
          <ReaderStatusState payload={payload} />
        ) : activeChapter ? (
          <AiCommentsProvider libraryItemId={libraryItemId}>
            <HighlightsProvider libraryItemId={libraryItemId}>
              <ReaderSelectionProvider>
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
              </ReaderSelectionProvider>
            </HighlightsProvider>
          </AiCommentsProvider>
        ) : null}
      </div>
    </div>
    </BookContextProvider>
  );
}
