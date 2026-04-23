import { cn } from "@/lib/cn";
import type { ReaderNavigationTarget } from "@/lib/reader-navigation";
import { resolveTocNavigationTarget } from "@/lib/reader-toc";
import type { ReadyReaderTocEntry } from "../shared/types";

type ReaderContentsTreeNodeProps = {
  activeChapterId: string;
  activePathIds: Set<string>;
  depth: number;
  entry: ReadyReaderTocEntry;
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  pendingChapterId: string | null;
};

function resolveEntryStateLabel({
  entry,
  isCurrentChapter,
  isCurrentSection,
  isPending,
}: {
  entry: ReadyReaderTocEntry;
  isCurrentChapter: boolean;
  isCurrentSection: boolean;
  isPending: boolean;
}) {
  if (isPending) {
    return "Loading";
  }

  if (isCurrentSection) {
    return "Current";
  }

  if (entry.blockId) {
    return "Section";
  }

  if (isCurrentChapter) {
    return "Chapter";
  }

  return "";
}

function resolveEntryLabelClassName({
  depth,
  isActivePath,
  isCurrentChapter,
  isCurrentSection,
}: {
  depth: number;
  isActivePath: boolean;
  isCurrentChapter: boolean;
  isCurrentSection: boolean;
}) {
  return cn(
    "min-w-0 font-(--font-reader) leading-6 transition",
    depth === 0 ? "text-[0.98rem]" : "text-[0.92rem]",
    isCurrentSection
      ? "font-semibold text-title"
      : isCurrentChapter || isActivePath
        ? "text-title"
        : depth > 0
          ? "text-title/62 hover:text-title"
          : "text-title/78 hover:text-title",
  );
}

export function ReaderContentsTreeNode({
  activeChapterId,
  activePathIds,
  depth,
  entry,
  onSelectChapter,
  pendingChapterId,
}: ReaderContentsTreeNodeProps) {
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
        style={{ marginLeft: `${depth * 14}px` }}
      >
        {isClickable && chapterId && navigationTarget ? (
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 text-left"
            onClick={() => onSelectChapter(chapterId, navigationTarget)}
          >
            <span
              className={resolveEntryLabelClassName({
                depth,
                isActivePath,
                isCurrentChapter,
                isCurrentSection,
              })}
            >
              {entry.label}
            </span>
            <span className="shrink-0 pt-1 font-(--font-ui) text-[0.62rem] uppercase tracking-[0.16em] text-ink/35">
              {resolveEntryStateLabel({
                entry,
                isCurrentChapter,
                isCurrentSection,
                isPending,
              })}
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
