import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import { resolveTocNavigationTarget } from "@/features/reader/toc";
import type { ReadyReaderTocEntry } from "../../shared/types";

type ReaderContentsTreeNodeProps = {
  activePathIds: Set<string>;
  currentEntryId: string | null;
  depth: number;
  entry: ReadyReaderTocEntry;
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  pendingChapterId: string | null;
};

function resolveEntryLabelClassName({
  depth,
  isActivePath,
  isCurrent,
}: {
  depth: number;
  isActivePath: boolean;
  isCurrent: boolean;
}) {
  return cn(
    "min-w-0 font-reader leading-6 transition",
    depth === 0 ? "text-[0.98rem]" : "text-[0.92rem]",
    isCurrent
      ? "font-semibold text-title"
      : isActivePath
        ? "text-title"
        : depth > 0
          ? "text-title/62 hover:text-title"
          : "text-title/78 hover:text-title",
  );
}

export function ReaderContentsTreeNode({
  activePathIds,
  currentEntryId,
  depth,
  entry,
  onSelectChapter,
  pendingChapterId,
}: ReaderContentsTreeNodeProps) {
  const t = useTranslations("reader.toc");
  const isActivePath = activePathIds.has(entry.id);
  const isPending = Boolean(entry.chapterId && pendingChapterId === entry.chapterId);
  const navigationTarget = resolveTocNavigationTarget(entry);
  const chapterId = entry.chapterId;
  const isClickable = Boolean(chapterId && navigationTarget);
  const isCurrent = entry.id === currentEntryId;
  const stateKey = isPending ? "loading" : isCurrent ? "current" : null;

  return (
    <div className="space-y-3">
      <div
        style={{ marginLeft: `${depth * 14}px` }}
      >
        {isClickable && chapterId && navigationTarget ? (
          <button
            type="button"
            aria-current={isCurrent ? "location" : undefined}
            className="flex w-full items-start justify-between gap-3 text-left"
            onClick={() => onSelectChapter(chapterId, navigationTarget)}
          >
            <span
              className={resolveEntryLabelClassName({
                depth,
                isActivePath,
                isCurrent,
              })}
            >
              {entry.label}
            </span>
            {stateKey ? (
              <span className="shrink-0 pt-1 font-ui text-[0.62rem] uppercase tracking-[0.16em] text-ink/35">
                {t(stateKey)}
              </span>
            ) : null}
          </button>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "min-w-0 font-ui text-[0.72rem] uppercase tracking-[0.14em]",
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
              activePathIds={activePathIds}
              currentEntryId={currentEntryId}
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
