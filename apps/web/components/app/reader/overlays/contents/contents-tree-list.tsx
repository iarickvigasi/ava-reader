import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import type { ReadyReaderTocEntry } from "../../shared/types";
import { ReaderContentsTreeNode } from "./reader-contents-tree-node";

type ContentsTreeListProps = {
  activePathIds: Set<string>;
  currentEntryId: string | null;
  entries: ReadyReaderTocEntry[];
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  pendingChapterId: string | null;
};

export function ContentsTreeList({
  activePathIds,
  currentEntryId,
  entries,
  onSelectChapter,
  pendingChapterId,
}: ContentsTreeListProps) {
  return (
    <nav className="mt-8">
      <div className="space-y-3">
        {entries.map((entry) => (
          <ReaderContentsTreeNode
            key={entry.id}
            activePathIds={activePathIds}
            currentEntryId={currentEntryId}
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
