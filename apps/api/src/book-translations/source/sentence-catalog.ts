import { identifyTranslationUnit as identify } from './unit-identity';
import type { ReaderChapter, ReaderBlock } from '../../reader/reader-types';
import { inlineText, isLiteralBlock } from './catalog-block-content';
import { createSentenceSegmenter } from '../../shared/create-sentence-segmenter';
import type { BilingualUnit } from '../types';

export function buildSentenceCatalog(
  chapter: ReaderChapter,
  contentRevision: string,
  sourceLanguage: string | null,
): BilingualUnit[] {
  const segmenter = createSentenceSegmenter(sourceLanguage);
  return chapter.blocks.flatMap((block) => blockUnits(block));

  function blockUnits(
    block: ReaderBlock,
    leafAddresses = false,
  ): BilingualUnit[] {
    if (block.kind === 'image') {
      return [
        identify(
          {
            blockId: block.id,
            startOffset: 0,
            endOffset: 0,
            text: '',
            kind: 'image',
          },
          chapter.chapterId,
          contentRevision,
        ),
      ];
    }
    if (isLiteralBlock(block))
      return [
        identify(
          {
            blockId: block.id,
            startOffset: 0,
            endOffset: block.text.length,
            text: block.text,
            kind: 'literal',
          },
          chapter.chapterId,
          contentRevision,
        ),
      ];
    if (block.kind === 'table')
      return block.cells.flatMap((cell) =>
        segmentText(inlineText(cell.inlines), cell.id, 0),
      );
    if (block.kind !== 'list') {
      return segmentText(inlineText(block.inlines), block.id, 0);
    }
    const byItem =
      leafAddresses || block.items.some((item) => item.children?.length);
    let offset = 0;
    return block.items.flatMap((item) => {
      const text = inlineText(item.inlines);
      const units = segmentText(
        text,
        byItem ? item.id : block.id,
        byItem ? 0 : offset,
        item.id,
      );
      offset += text.length;
      return [
        ...units,
        ...(item.children ?? []).flatMap((child) => blockUnits(child, byItem)),
      ];
    });
  }

  function segmentText(
    text: string,
    blockId: string,
    offset: number,
    itemId?: string,
  ): BilingualUnit[] {
    return Array.from(segmenter.segment(text))
      .filter(({ segment }) => segment.trim().length > 0)
      .map(({ segment, index }) =>
        identify(
          {
            blockId,
            ...(itemId ? { itemId } : {}),
            startOffset: offset + index,
            endOffset: offset + index + segment.length,
            text: segment,
            kind: 'sentence',
          },
          chapter.chapterId,
          contentRevision,
        ),
      );
  }
}
