import type { PrismaService } from '../../prisma/prisma.service';
import { parseImportManifest } from './manifest';

export async function listReviews(prisma: PrismaService, workId?: string) {
  const entries = await prisma.catalogEntry.findMany({
    where: {
      importKey: { not: null },
      book: { visibility: 'PUBLIC', privateOwnerId: null },
      ...(workId
        ? { importEvidence: { path: ['workId'], equals: workId } }
        : {}),
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    take: 100,
    include: {
      book: {
        select: {
          title: true,
          authors: true,
          language: true,
          processingRuns: {
            where: { pipeline: 'normalize-reader-package-v1' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true, errorMessage: true },
          },
        },
      },
    },
  });
  return entries.map((entry) => {
    const manifest = parseImportManifest(JSON.stringify(entry.importEvidence));
    const run = entry.book.processingRuns[0];
    return {
      id: entry.id,
      editionId: manifest.editionId,
      checksum: manifest.checksum,
      title: entry.book.title,
      authors: entry.book.authors,
      language: entry.book.language,
      status: entry.status,
      processingStatus: run?.status ?? 'PENDING',
      error: run?.errorMessage,
      syncPending: entry.importSyncPending,
      withdrawn: !!entry.importPublishedAt && entry.status !== 'PUBLISHED',
      sourceUrl:
        manifest.sourceUrl ??
        `https://archive.org/details/${manifest.iaIdentifier}`,
      filename: manifest.filename,
      review: manifest.review ?? null,
    };
  });
}
