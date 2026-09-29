import { NotFoundException } from '@nestjs/common';
import type { CanonicalBookV2 } from '../../pdf-conversion/contracts/generated/ava-reader-3';
import type { BilingualUnit } from '../types';
import { createSentenceSegmenter } from '../../shared/create-sentence-segmenter';
import { identifyTranslationUnit } from './unit-identity';
export function canonicalSentenceCatalog(
  book: CanonicalBookV2,
  chapterId: string,
  revision: string,
  language: string | null,
): BilingualUnit[] {
  const chapter = book.chapters.find((c) => c.id === chapterId);
  if (!chapter)
    throw new NotFoundException('The requested chapter was not found.');
  const blocks = new Map(book.blocks.map((b) => [b.id, b]));
  const segmenter = createSentenceSegmenter(language);
  const identify = (unit: Omit<BilingualUnit, 'id'>) =>
    identifyTranslationUnit(unit, chapterId, revision);
  const text = (
    blockId: string,
    value: string,
    literal = false,
    verse = false,
  ) =>
    literal
      ? [
          identify({
            blockId,
            kind: 'literal',
            text: value,
            startOffset: 0,
            endOffset: value.length,
          }),
        ]
      : (verse
          ? [...value.matchAll(/[^\n]+(?:\n|$)/g)].map((m) => ({
              segment: m[0],
              index: m.index,
            }))
          : Array.from(segmenter.segment(value))
        )
          .filter((s) => s.segment.trim())
          .map((s) =>
            identify({
              blockId,
              kind: 'sentence',
              text: s.segment,
              startOffset: s.index,
              endOffset: s.index + s.segment.length,
            }),
          );
  return chapter.block_ids.flatMap((id): BilingualUnit[] => {
    const block = blocks.get(id)!;
    if (block.kind === 'figure')
      return [
        identify({
          blockId: id,
          kind: 'image',
          text: '',
          startOffset: 0,
          endOffset: 0,
        }),
      ];
    if (block.kind === 'separator') return text(id, '', true);
    if (block.kind === 'table')
      return [...block.cells]
        .sort((a, b) => a.row - b.row || a.column - b.column)
        .flatMap((cell) => text(cell.id, cell.content.text));
    return text(
      id,
      block.content.text,
      block.kind === 'code',
      block.kind === 'verse',
    );
  });
}
