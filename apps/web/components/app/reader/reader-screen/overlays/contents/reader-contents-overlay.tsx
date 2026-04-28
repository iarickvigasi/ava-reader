import { useMemo } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import { formatAuthors } from "@/lib/format-authors";
import type { ReaderNavigationTarget } from "@/lib/reader-navigation";
import {
  countUniqueTocChapters,
  findActiveTocPathIds,
} from "@/lib/reader-toc";
import type { ReadyReaderPayload, ReadyReaderTocEntry } from "../../shared/types";
import { clamp } from "../../shared/utils";
import { PanelTitle } from "../panel-title";
import { useCloseOnEscape } from "../use-close-on-escape";
import { ReaderContentsTreeNode } from "./reader-contents-tree-node";

type ReaderContentsOverlayProps = {
  activeChapterId: string;
  activeLocator: ReaderLocator | null;
  onClose: () => void;
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
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
              <ContentsHeader
                authors={payload.book.authors}
                onClose={onClose}
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
    <div className="absolute inset-0 border-r border-line/35 bg-linear-to-r from-paper-strong/88 via-paper/78 to-paper/50 shadow-[10px_0_40px_rgba(31,27,24,0.05)] backdrop-blur-[7px] md:hidden" />
  );
}

function ContentsHeader({
  authors,
  onClose,
  title,
}: {
  authors: string[] | null | undefined;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <PanelTitle>Contents</PanelTitle>
        <h2 className="mt-4 font-(--font-reader) text-[2rem] leading-[0.95] tracking-[-0.04em] text-title">
          {title}
        </h2>
        <p className="mt-4 font-(--font-ui) text-[0.82rem] uppercase tracking-[0.18em] text-title/70">
          {formatAuthors(authors)}
        </p>
      </div>
      <ContentsCloseButton onClose={onClose} />
    </div>
  );
}

function ContentsCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line/45 bg-white/55 text-ink transition hover:bg-white md:hidden"
      onClick={onClose}
    >
      <span className="font-(--font-ui) text-lg leading-none">×</span>
    </button>
  );
}

function ContentsProgress({
  chapterCount,
  completionPercent,
}: {
  chapterCount: number;
  completionPercent: number;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <span className="font-(--font-ui) text-[0.62rem] uppercase tracking-[0.16em] text-ink/55">
          {completionPercent}% completed
        </span>
        <span className="font-(--font-ui) text-[0.62rem] uppercase tracking-[0.16em] text-ink/35">
          {chapterCount} chapters
        </span>
      </div>
      <ProgressBar completionPercent={completionPercent} />
    </div>
  );
}

function ProgressBar({ completionPercent }: { completionPercent: number }) {
  return (
    <div className="mt-3 h-1.5 rounded-full bg-line/20">
      <div
        className="h-full rounded-full bg-title transition-[width]"
        style={{
          width: `${clamp(completionPercent, 0, 100)}%`,
        }}
      />
    </div>
  );
}

function ContentsTreeList({
  activeChapterId,
  activePathIds,
  entries,
  onSelectChapter,
  pendingChapterId,
}: {
  activeChapterId: string;
  activePathIds: Set<string>;
  entries: ReadyReaderTocEntry[];
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  pendingChapterId: string | null;
}) {
  return (
    <nav className="mt-8 min-h-0 flex-1 overflow-auto pb-8 pr-3">
      <div className="space-y-3">
        {entries.map((entry) => (
          <ReaderContentsTreeNode
            key={entry.id}
            activeChapterId={activeChapterId}
            activePathIds={activePathIds}
            depth={0}
            entry={entry}
            onSelectChapter={onSelectChapter}
            pendingChapterId={pendingChapterId}
          />
        ))}
      </div>
    </nav>
  );
}
