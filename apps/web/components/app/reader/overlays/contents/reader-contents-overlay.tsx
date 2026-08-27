import { useMemo } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import {
  countUniqueTocChapters,
  findActiveTocPathIds,
} from "@/features/reader/toc";
import type { ReadyReaderPayload } from "../../shared/types";
import { useCloseOnEscape } from "../use-close-on-escape";
import { ContentsBookHeading } from "./contents-book-heading";
import { ContentsHeader } from "./contents-header";
import { ContentsProgress } from "./contents-progress";
import { ContentsTreeList } from "./contents-tree-list";

type ReaderContentsOverlayProps = {
  activeChapterId: string;
  activeLocator: ReaderLocator | null;
  onClose: () => void;
  onSelectChapter: (chapterId: string, target: ReaderNavigationTarget) => void;
  payload: ReadyReaderPayload;
  pendingChapterId: string | null;
};

export function ReaderContentsOverlay({
  activeChapterId,
  activeLocator,
  onClose,
  onSelectChapter,
  payload,
  pendingChapterId,
}: ReaderContentsOverlayProps) {
  const activePathIds = useMemo(
    () =>
      new Set(
        findActiveTocPathIds(payload.toc, {
          activeBlockId: activeLocator?.blockId ?? null,
          activeChapterId,
        }),
      ),
    [activeChapterId, activeLocator?.blockId, payload.toc],
  );
  const chapterCount = useMemo(
    () => countUniqueTocChapters(payload.toc),
    [payload.toc],
  );

  useCloseOnEscape(onClose);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <ContentsBackdrop onClose={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-full justify-start md:w-94">
        <div className="relative h-full w-full max-w-[24rem] md:w-94 md:max-w-94">
          <ContentsBackgroundLayer />
          <div className="relative z-10 flex h-full flex-col md:pt-24">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-8 md:animate-[reader-contents-enter_320ms_cubic-bezier(0.22,1,0.36,1)_140ms_both] md:px-8 md:py-0">
              <ContentsHeader onClose={onClose} />
              <div className="mt-4 min-h-0 flex-1 overflow-auto pb-8 pr-3">
                <ContentsBookHeading
                  authors={payload.book.authors}
                  title={payload.book.title}
                />
                <ContentsProgress
                  chapterCount={chapterCount}
                  completionPercent={payload.progress.completionPercent}
                />
                <ContentsTreeList
                  activeChapterId={activeChapterId}
                  activePathIds={activePathIds}
                  entries={payload.toc}
                  onSelectChapter={onSelectChapter}
                  pendingChapterId={pendingChapterId}
                />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ContentsBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close contents panel"
      className="pointer-events-auto absolute inset-0 bg-transparent md:left-94"
      onClick={onClose}
    />
  );
}

function ContentsBackgroundLayer() {
  return (
    <div className="absolute inset-0 bg-linear-to-r from-paper-strong/88 via-paper/78 to-paper/50 shadow-[10px_0_40px_rgba(31,27,24,0.05)] backdrop-blur-[7px] md:hidden" />
  );
}
