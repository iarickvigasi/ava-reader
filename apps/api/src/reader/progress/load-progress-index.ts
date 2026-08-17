import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { loadReaderPackage } from '../package/load-reader-package';
import type { ReadingProgressIndex } from '../reader-types';
import {
  buildReadingProgressIndex,
  parseStoredReadingProgressIndex,
} from './reading-progress-index';

// Reads the compact progress index for a derived-reader file. For rows that
// were created before the `readingProgressIndex` column existed (or whose
// stored JSON doesn't validate), falls back to parsing the full package once
// and writes the index back so future calls are O(1).
export async function loadReadingProgressIndex(
  prisma: PrismaService,
  file: {
    blobId: string;
    id: string;
    readingProgressIndex: unknown;
  },
): Promise<ReadingProgressIndex> {
  const stored = parseStoredReadingProgressIndex(file.readingProgressIndex);
  if (stored) {
    return stored;
  }
  const readerPackage = await loadReaderPackage(prisma, file.blobId);
  const index = buildReadingProgressIndex(readerPackage);
  // Fire-and-forget back-fill — failure to persist must not block the
  // progress write the user is currently making.
  prisma.bookFile
    .update({
      where: { id: file.id },
      data: {
        readingProgressIndex: index as unknown as Prisma.InputJsonValue,
      },
    })
    .catch(() => {
      // Swallow — next request will retry the back-fill.
    });
  return index;
}
