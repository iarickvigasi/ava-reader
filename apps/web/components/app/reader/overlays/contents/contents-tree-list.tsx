import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import type { ReadyReaderTocEntry } from "../../shared/types";
import { ReaderContentsTreeNode } from "./reader-contents-tree-node";

type ContentsTreeListProps = {
  activeChapterId: string;
  activePathIds: Set<string>;
  entries: ReadyReaderTocEntry[];
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  pendingChapterId: string | null;
};

export function ContentsTreeList({
  activeChapterId,
  activePathIds,
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
