import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ReadyReaderPayload } from "./types";
import { formatReaderHeaderLine } from "./utils";

export function ReadyReaderHeader({
  activeChapter,
  payload,
}: {
  activeChapter: ReaderChapterPayload;
  payload: ReadyReaderPayload;
}) {
  return (
    <header className="min-w-0 flex-1 pt-1">
      <h1 className="max-w-full truncate font-(--font-ui) text-[1.05rem] leading-none tracking-[0.01em] text-title sm:text-[1.2rem]">
        {formatReaderHeaderLine(payload, activeChapter)}
      </h1>
    </header>
  );
}

export function ReadyReaderActivityStatus({
  isBootstrapping,
  isLoadingChapter,
  isRefreshingWindow,
}: {
  isBootstrapping: boolean;
  isLoadingChapter: boolean;
  isRefreshingWindow: boolean;
}) {
  if (isBootstrapping) {
    return (
      <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/45">
        Restoring your last page...
      </p>
    );
  }

  if (isLoadingChapter) {
    return (
      <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/45">
        Loading chapter...
      </p>
    );
  }

  if (isRefreshingWindow) {
    return (
      <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/35">
        Preloading nearby chapter...
      </p>
    );
  }

  return null;
}

export function ReadyReaderProgress({
  completionPercent,
  currentPageIndex,
  pageCount,
}: {
  completionPercent: number;
  currentPageIndex: number;
  pageCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 pb-4">
      <div className="flex flex-wrap items-center gap-3 font-(--font-ui) text-[0.7rem] uppercase tracking-[0.16em] text-ink/45">
        <span>{completionPercent}% complete</span>
        <span>
          Page {Math.min(currentPageIndex + 1, pageCount)} of {pageCount} in chapter
        </span>
      </div>
    </div>
  );
}
