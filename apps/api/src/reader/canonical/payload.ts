import { BadRequestException } from '@nestjs/common';
import type { OwnedLibraryItem } from '../library-item-access';
import type { ReaderStatusPayload } from '../payload/reader-payload-types';
import { toBookPayload } from '../payload/book-payload';
import { createProgressSummary } from '../progress/progress-summary';
import type { AcceptedReader } from './load';
export function canonicalReaderPayload(
  item: OwnedLibraryItem,
  accepted: AcceptedReader,
  requested?: string,
): ReaderStatusPayload {
  const progress = createProgressSummary(item.progress);
  const { readerPackage, resourceUrls } = accepted;
  const spine = readerPackage.book.spine;
  if (requested !== undefined && !spine.includes(requested))
    throw new BadRequestException('The requested chapter does not exist.');
  const resume = progress.locator?.chapterId;
  const activeChapterId =
    requested ?? (resume && spine.includes(resume) ? resume : spine[0]);
  // The v3 client renders the complete immutable graph. Never make a lossy v2 projection.
  return {
    status: 'READY',
    book: toBookPayload(item, accepted.kind === 'epub-import' ? 'EPUB' : 'PDF'),
    progress,
    activeChapterId,
    chapters: [],
    toc: [],
    readerPackage,
    resourceUrls,
  };
}
