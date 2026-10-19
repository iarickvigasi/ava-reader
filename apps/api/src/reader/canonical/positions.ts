import { BadRequestException } from '@nestjs/common';
import type {
  CanonicalBookV2,
  TextValue,
} from '../../pdf-conversion/contracts/generated/ava-reader-3';
import type { ReaderLocator } from '../reader-types';
type Position = {
  chapterId: string;
  blockId: string;
  content?: TextValue;
  ordinal: number;
};
export function canonicalPositions(book: CanonicalBookV2) {
  const blocks = new Map(book.blocks.map((block) => [block.id, block]));
  const chapters = new Map(
    book.chapters.map((chapter) => [chapter.id, chapter]),
  );
  const positions = new Map<string, Position>();
  let total = 0;
  for (const chapterId of book.spine) {
    for (const blockId of chapters.get(chapterId)!.block_ids) {
      const block = blocks.get(blockId)!;
      positions.set(blockId, {
        chapterId,
        blockId,
        ordinal: total,
        ...('content' in block ? { content: block.content } : {}),
      });
      if (block.kind === 'table')
        for (const cell of [...block.cells].sort(
          (a, b) => a.row - b.row || a.column - b.column,
        ))
          positions.set(cell.id, {
            chapterId,
            blockId: cell.id,
            content: cell.content,
            ordinal: total++,
          });
      else total++;
    }
  }
  return { positions, total };
}
export function canonicalProgressMetrics(
  book: CanonicalBookV2,
  locator: ReaderLocator,
) {
  const { positions, total } = canonicalPositions(book);
  const position = positions.get(locator.blockId);
  if (
    !position ||
    position.chapterId !== locator.chapterId ||
    !Number.isSafeInteger(locator.textOffset) ||
    (position.content
      ? !position.content.codepoint_utf16.includes(locator.textOffset)
      : locator.textOffset !== 0)
  )
    throw new BadRequestException(
      'The requested content position does not exist.',
    );
  const chapter = book.chapters.find((item) => item.id === locator.chapterId)!;
  const entry = book.toc.findLast(
    (item) =>
      item.target.chapter_id === locator.chapterId &&
      item.target.block_id === locator.blockId,
  );
  return {
    chapterLabel: entry?.label ?? chapter.title,
    completionPercent: Math.min(
      100,
      Math.round(((position.ordinal + 1) / Math.max(1, total)) * 100),
    ),
  };
}
