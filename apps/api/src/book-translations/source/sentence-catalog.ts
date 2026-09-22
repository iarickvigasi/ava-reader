import { createHash } from 'node:crypto';
import type { ReaderChapter, ReaderInline } from '../../reader/reader-types';
import { createSentenceSegmenter } from './create-sentence-segmenter';
import type { BilingualUnit } from '../types';

export function buildSentenceCatalog(
  chapter: ReaderChapter,
  contentRevision: string,
  sourceLanguage: string | null,
): BilingualUnit[] {
  const segmenter = createSentenceSegmenter(sourceLanguage);
  return chapter.blocks.flatMap((block) => {
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
    if (block.kind !== 'list') {
      return segmentText(inlineText(block.inlines), block.id, 0);
    }
    let offset = 0;
    return block.items.flatMap((item) => {
      const text = inlineText(item.inlines);
      const units = segmentText(text, block.id, offset, item.id);
      offset += text.length;
      return units;
    });
  });

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

function inlineText(inlines: ReaderInline[]) {
  // block.text is normalized for search; DOM locators count verbatim text nodes.
  return inlines
    .map((inline) => (inline.kind === 'text' ? inline.text : ''))
    .join('');
}

function identify(
  unit: Omit<BilingualUnit, 'id'>,
  chapterId: string,
  revision: string,
): BilingualUnit {
  const id = createHash('sha256')
    .update(JSON.stringify([revision, chapterId, unit]))
    .digest('hex');
  return { id, ...unit };
}
