import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { ChartIcon } from "@/components/app/shared/app-icons";
import type {
  ReaderChapterPayload,
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types";
import { cn } from "@/lib/cn";
import type { ReaderNavigationTarget } from "@/lib/reader-navigation";
import {
  countUniqueTocChapters,
  findActiveTocPathIds,
  resolveTocNavigationTarget,
} from "@/lib/reader-toc";
import { clamp } from "./utils";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-(--font-ui) text-[0.68rem] uppercase tracking-[0.18em] text-ink/45">
      {children}
    </p>
  );
}

export function ReaderSidebarOverlay({
  activeChapter,
  fontScale,
  isLoadingChapter,
  onClose,
  onDecreaseFont,
  onIncreaseFont,
  payload,
}: {
  activeChapter: ReaderChapterPayload;
  fontScale: number;
  isLoadingChapter: boolean;
  onClose: () => void;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close reader panel"
        className="absolute inset-0 bg-black/25 backdrop-blur-md"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full justify-end p-3 sm:p-5">
        <div className="flex h-full w-full max-w-md flex-col rounded-4xl border border-line/70 bg-surface/95 p-5 shadow-(--shadow-card) backdrop-blur xl:max-w-120 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.18em] text-ink/45">
                Reader
              </p>
              <p className="mt-2 font-(--font-reader) text-2xl leading-none text-ink">
                {activeChapter.label}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-line/50 bg-soft-fill/45 px-3 py-1.5 font-(--font-ui) text-[0.7rem] uppercase tracking-[0.14em] text-ink/55">
                {payload.progress.completionPercent}%
              </div>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-full border border-line/45 bg-soft-fill/80 text-ink transition hover:bg-soft-tone-fill"
                onClick={onClose}
              >
                <span className="font-(--font-ui) text-lg leading-none">×</span>
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-line/45 bg-soft-fill/80 font-(--font-ui) text-sm text-ink transition hover:bg-soft-tone-fill"
              onClick={onDecreaseFont}
            >
              A-
            </button>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-line/45 bg-soft-fill/80 font-(--font-ui) text-sm text-ink transition hover:bg-soft-tone-fill"
              onClick={onIncreaseFont}
            >
              A+
            </button>
            <p className="ml-2 font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/45">
              Type {Math.round(fontScale * 100)}%
            </p>
          </div>

          <div className="mt-8 min-h-0 flex-1 space-y-3">
            <SectionLabel>Reader controls</SectionLabel>
            <div className="rounded-3xl border border-line/45 bg-white/45 p-4">
              <p className="font-(--font-reader) text-lg leading-7 text-ink">
                Open `Contents` from the left rail to jump between chapters
                while keeping this panel focused on reading controls.
              </p>
            </div>
          </div>

          {isLoadingChapter ? (
            <div className="mt-6 border-t border-line/40 pt-5">
              <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/40">
                Switching chapters...
              </p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function ReaderContentsOverlay({
  activeChapterId,
  activeLocator,
  onClose,
  onSelectChapter,
  payload,
  pendingChapterId,
}: {
  activeChapterId: string;
  activeLocator: ReaderLocator | null;
  onClose: () => void;
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
  pendingChapterId: string | null;
}) {
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close contents panel"
        className="pointer-events-auto absolute inset-0 bg-transparent md:left-94"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 left-0 flex w-full justify-start md:w-94">
        <div className="relative h-full w-full max-w-[24rem] md:w-94 md:max-w-94">
          <div className="absolute inset-0 border-r border-line/35 bg-linear-to-r from-paper-strong/88 via-paper/78 to-paper/50 shadow-[10px_0_40px_rgba(31,27,24,0.05)] backdrop-blur-[7px] md:hidden" />
          <div className="relative z-10 flex h-full flex-col md:pt-24">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-8 md:animate-[reader-contents-enter_320ms_cubic-bezier(0.22,1,0.36,1)_140ms_both] md:px-8 md:py-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <SectionLabel>Contents</SectionLabel>
                  <h2 className="mt-4 font-(--font-reader) text-[2rem] leading-[0.95] tracking-[-0.04em] text-title">
                    {payload.book.title}
                  </h2>
                  {payload.book.author ? (
                    <p className="mt-4 font-(--font-ui) text-[0.82rem] uppercase tracking-[0.18em] text-title/70">
                      {payload.book.author}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line/45 bg-white/55 text-ink transition hover:bg-white md:hidden"
                  onClick={onClose}
                >
                  <span className="font-(--font-ui) text-lg leading-none">×</span>
                </button>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-(--font-ui) text-[0.62rem] uppercase tracking-[0.16em] text-ink/55">
                    {payload.progress.completionPercent}% completed
                  </span>
                  <span className="font-(--font-ui) text-[0.62rem] uppercase tracking-[0.16em] text-ink/35">
                    {chapterCount} chapters
                  </span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-line/20">
                  <div
                    className="h-full rounded-full bg-title transition-[width]"
                    style={{
                      width: `${clamp(payload.progress.completionPercent, 0, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <nav className="mt-8 min-h-0 flex-1 overflow-auto pb-8 pr-3">
                <div className="space-y-3">
                  {payload.toc.map((entry) => (
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
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ReaderContentsTreeNode({
  activeChapterId,
  activePathIds,
  depth,
  entry,
  onSelectChapter,
  pendingChapterId,
}: {
  activeChapterId: string;
  activePathIds: Set<string>;
  depth: number;
  entry: Extract<ReaderStatusPayload, { status: "READY" }>['toc'][number];
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  pendingChapterId: string | null;
}) {
  const isActivePath = activePathIds.has(entry.id);
  const isPending = Boolean(entry.chapterId && pendingChapterId === entry.chapterId);
  const navigationTarget = resolveTocNavigationTarget(entry);
  const chapterId = entry.chapterId;
  const isClickable = Boolean(chapterId && navigationTarget);
  const isCurrentSection = Boolean(
    entry.blockId && isActivePath && entry.chapterId === activeChapterId,
  );
  const isCurrentChapter = !isCurrentSection && entry.chapterId === activeChapterId;

  return (
    <div className="space-y-3">
      <div
        className="border-l border-title/10 pl-4"
        style={{ marginLeft: `${depth * 14}px` }}
      >
        {isClickable && chapterId && navigationTarget ? (
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 text-left"
            onClick={() => onSelectChapter(chapterId, navigationTarget)}
          >
            <span
              className={cn(
                "min-w-0 font-(--font-reader) leading-6 transition",
                depth === 0 ? "text-[0.98rem]" : "text-[0.92rem]",
                isCurrentSection
                  ? "font-semibold text-title"
                  : isCurrentChapter || isActivePath
                    ? "text-title"
                    : depth > 0
                      ? "text-title/62 hover:text-title"
                      : "text-title/78 hover:text-title",
              )}
            >
              {entry.label}
            </span>
            <span className="shrink-0 pt-1 font-(--font-ui) text-[0.62rem] uppercase tracking-[0.16em] text-ink/35">
              {isPending
                ? "Loading"
                : isCurrentSection
                  ? "Current"
                  : entry.blockId
                    ? "Section"
                    : isCurrentChapter
                      ? "Chapter"
                      : ""}
            </span>
          </button>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "min-w-0 font-(--font-ui) text-[0.72rem] uppercase tracking-[0.14em]",
                isActivePath ? "text-title/72" : "text-ink/42",
              )}
            >
              {entry.label}
            </span>
          </div>
        )}
      </div>

      {entry.children.length > 0 ? (
        <div className="space-y-3">
          {entry.children.map((child) => (
            <ReaderContentsTreeNode
              key={child.id}
              activeChapterId={activeChapterId}
              activePathIds={activePathIds}
              depth={depth + 1}
              entry={child}
              onSelectChapter={onSelectChapter}
              pendingChapterId={pendingChapterId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReaderPanelButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line/50 bg-white/70 px-4 font-ui text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink shadow-[0_14px_34px_rgba(31,27,24,0.08)] transition hover:bg-white"
      onClick={onOpen}
    >
      <ChartIcon className="size-4" />
      Reader panel
    </button>
  );
}
