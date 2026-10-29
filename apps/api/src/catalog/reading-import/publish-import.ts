import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { loadReaderPackage } from '../../reader/package/load-reader-package';
import { loadImport } from './load-import';
import { assessPackage } from './assess-package';
import { parseImportManifest } from './manifest';
import { parseReview } from './review-schema';
import type { Prisma } from '@prisma/client';

export async function publishImport(
  prisma: PrismaService,
  editionId: string,
  checksum: string,
  approval?: unknown,
  reviewer = '',
) {
  const { entry, source, output, receipt, processed } = await loadImport(
    prisma,
    editionId,
    checksum,
  );
  if (receipt.status === 'READY' && !approval) return receipt;
  if (
    !['PROCESSED', 'WITHDRAWN', 'READY'].includes(receipt.status) ||
    (receipt.status === 'WITHDRAWN' && !processed) ||
    !output ||
    !source
  )
    throw new ConflictException('Reader processing has not completed');
  assessPackage(await loadReaderPackage(prisma, output.blobId), checksum);
  const manifest = parseImportManifest(JSON.stringify(entry.importEvidence));
  const review = parseReview(
    approval,
    checksum,
    reviewer,
    manifest.sourceUrl ??
      `https://archive.org/details/${manifest.iaIdentifier}`,
  );
  await prisma.catalogEntry.updateMany({
    where: {
      id: entry.id,
      status: entry.status,
      importPublishedAt: entry.importPublishedAt ?? null,
      importSyncRevision: entry.importSyncRevision,
      book: {
        visibility: 'PUBLIC',
        privateOwnerId: null,
        AND: [
          { files: { some: { id: source.id, isPrimary: true } } },
          {
            files: {
              some: {
                id: output.id,
                isPrimary: true,
                processingStatus: 'READY',
              },
            },
          },
        ],
      },
    },
    data: {
      status: 'PUBLISHED',
      importPublishedAt: new Date(),
      importEvidence: {
        ...manifest,
        review,
      } as unknown as Prisma.InputJsonValue,
      importSyncPending: true,
      importSyncRevision: { increment: 1 },
    },
  });
  const published = (await loadImport(prisma, editionId, checksum)).receipt;
  if (published.status !== 'READY')
    throw new ConflictException('Reading copy changed during publication');
  return published;
}
