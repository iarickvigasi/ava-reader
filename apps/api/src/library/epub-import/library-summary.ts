import type { Prisma } from '@prisma/client';
import { CANONICAL_EPUB_PIPELINE } from './enqueue';

// Only lightweight durable state belongs in cards; never load package bytes,
// validation reports or internal error messages for a library overview.
export const epubLibrarySummaryInclude = {
  canonicalEpubImport: {
    select: {
      finalContentId: true,
      readerSha256: true,
      acceptance: { select: { createdAt: true } },
      readerFile: {
        select: {
          kind: true,
          format: true,
          isPrimary: true,
          processingStatus: true,
          updatedAt: true,
          blob: { select: { checksum: true } },
        },
      },
    },
  },
  processingRuns: {
    where: { pipeline: CANONICAL_EPUB_PIPELINE },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { id: true, status: true, updatedAt: true },
  },
} satisfies Prisma.BookInclude;

export type EpubLibraryBook = {
  canonicalImportPrivate?: boolean;
} & Partial<
  Pick<
    Prisma.BookGetPayload<{ include: typeof epubLibrarySummaryInclude }>,
    'canonicalEpubImport' | 'processingRuns'
  >
>;

export function epubLibrarySummary(book: EpubLibraryBook) {
  if (!book.canonicalImportPrivate) return null;
  const record = book.canonicalEpubImport;
  const run = book.processingRuns?.[0];
  const file = record?.readerFile;
  const ready = Boolean(
    record?.acceptance &&
    record.finalContentId &&
    file?.isPrimary &&
    file.kind === 'DERIVED_READER' &&
    file.format === 'READER_PACKAGE' &&
    file.processingStatus === 'READY' &&
    file.blob.checksum === record.readerSha256,
  );
  const status = ready
    ? 'READY'
    : run?.status === 'FAILED' ||
        record?.acceptance ||
        file?.processingStatus === 'FAILED'
      ? 'FAILED'
      : record
        ? 'AWAITING_ACCEPTANCE'
        : run?.status === 'PROCESSING'
          ? 'PROCESSING'
          : 'PENDING';
  const timestamps = [
    run?.updatedAt,
    record?.acceptance?.createdAt,
    file?.updatedAt,
  ]
    .filter((value): value is Date => Boolean(value))
    .map((value) => value.getTime());
  return {
    status,
    runId: run?.id ?? null,
    updatedAt: timestamps.length
      ? new Date(Math.max(...timestamps)).toISOString()
      : null,
    finalContentId: ready ? (record?.finalContentId ?? null) : null,
  };
}
