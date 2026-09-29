import type {
  ReaderChapterPayload,
  ReaderTocNode,
} from "@/lib/api-types/reader";
import { collectTocChapterEntries } from "./toc";

export function readableChapterLabel(
  chapter: ReaderChapterPayload,
  toc: ReaderTocNode[],
): string {
  const tocLabel = collectTocChapterEntries(toc).get(chapter.chapterId)?.label;
  const filename = chapter.href.split("#")[0].split("/").at(-1);
  for (const candidate of [tocLabel, chapter.label, chapter.title]) {
    const label = candidate?.trim();
    if (
      !label ||
      label === chapter.chapterId ||
      label === chapter.href ||
      label === filename
    )
      continue;
    if (/^chapter-\d+(?:-|$)/i.test(label) || /\.(?:x?html?|xml)$/i.test(label))
      continue;
    return label;
  }
  return `${chapter.spineIndex + 1}.`;
}
