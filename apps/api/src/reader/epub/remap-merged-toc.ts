import type { ReaderChapter, ReaderTocNode } from '../reader-types';

export function remapMergedToc(
  toc: ReaderTocNode[],
  source: ReaderChapter[],
  chapters: ReaderChapter[],
): ReaderTocNode[] {
  const destinationByBlock = new Map(
    chapters.flatMap((chapter) =>
      chapter.blocks.map((block) => [block.id, chapter] as const),
    ),
  );
  const firstBlockByChapter = new Map(
    source.map((chapter) => [chapter.chapterId, chapter.blocks[0]?.id]),
  );
  const visit = (node: ReaderTocNode): ReaderTocNode => {
    const blockId =
      node.blockId ?? firstBlockByChapter.get(node.chapterId ?? '');
    const destination = blockId ? destinationByBlock.get(blockId) : undefined;
    return {
      ...node,
      chapterId: destination?.chapterId ?? null,
      spineIndex: destination?.spineIndex ?? null,
      blockId: destination ? (blockId ?? null) : null,
      children: node.children.map(visit),
    };
  };
  return toc.map(visit);
}
