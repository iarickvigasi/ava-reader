"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { ReadyReader } from "./reader-screen/ready-reader";
import { ReaderStatusState } from "./reader-screen/reader-status-state";
import type { ReaderScreenProps } from "./reader-screen/types";
import { roundFontScale } from "./reader-screen/utils";
import { useReaderScreenController } from "./reader-screen/use-reader-screen-controller";

export function ReaderScreen({
  initialPayload,
  libraryItemId,
  persistenceMode = "remote",
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
        {payload.status !== "READY" ? (
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
            onDecreaseFont={() =>
              setFontScale((current) =>
                Math.max(0.85, roundFontScale(current - 0.1)),
              )
            }
            onIncreaseFont={() =>
              setFontScale((current) =>
                Math.min(1.35, roundFontScale(current + 0.1)),
              )
            }
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
