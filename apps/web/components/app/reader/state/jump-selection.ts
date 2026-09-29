import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import { resolveJumpTarget } from "@/features/reader/jump-target";

export function jumpSelection(
  chapters: ReaderChapterPayload[],
  chapterId: string,
  target?: ReaderNavigationTarget,
) {
  const chapter = chapters.find((item) => item.chapterId === chapterId);
  return chapter
    ? resolveJumpTarget(chapter, target)
    : {
        chapterId,
        blockId: target?.blockId ?? "",
        textOffset: target?.textOffset ?? 0,
      };
}
