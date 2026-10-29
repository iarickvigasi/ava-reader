import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { importKey } from './import-key';

export async function loadImport(
  prisma: PrismaService,
  editionId: string,
  checksum: string,
) {
  const entry = await prisma.catalogEntry.findUnique({
    where: { importKey: importKey(editionId, checksum) },
    include: {
      book: {
        include: {
          coverBlob: { select: { catalogBlobId: true } },
          files: {
            where: { isPrimary: true },
            include: { blob: { select: { checksum: true } } },
          },
          processingRuns: {
            where: { pipeline: 'normalize-reader-package-v1' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });
  if (!entry) throw new NotFoundException('Reading import not found');
  const source = entry.book.files.find(
    (file) => file.kind === 'SOURCE' && file.format === 'EPUB',
  );
  const output = entry.book.files.find(
    (file) =>
      file.kind === 'DERIVED_READER' && file.processingStatus === 'READY',
  );
  const run = entry.book.processingRuns[0];
  const language = (entry.importEvidence as { language?: unknown } | null)
    ?.language;
  const eligible =
    entry.book.visibility === 'PUBLIC' &&
    !entry.book.privateOwnerId &&
    typeof language === 'string' &&
    entry.book.language === language &&
    source?.blob.checksum === checksum;
  const processed =
    eligible &&
    output &&
    run?.status === 'READY' &&
    run.sourceFileId === source.id &&
    run.outputFileId === output.id;
  const status =
    !eligible ||
    entry.status === 'ARCHIVED' ||
    (entry.importPublishedAt && entry.status !== 'PUBLISHED')
      ? 'WITHDRAWN'
      : run?.status === 'FAILED'
        ? 'FAILED'
        : processed
          ? entry.status === 'PUBLISHED' && entry.importPublishedAt
            ? 'READY'
            : 'PROCESSED'
          : 'PENDING';
  return {
    entry,
    processed: !!processed,
    source,
    output,
    receipt: {
      id: entry.id,
      editionId,
      checksum,
      status,
      syncPending: entry.importSyncPending,
      coverCatalogBlobId: entry.book.coverBlob?.catalogBlobId ?? null,
      error: run?.errorMessage,
    },
  };
}
