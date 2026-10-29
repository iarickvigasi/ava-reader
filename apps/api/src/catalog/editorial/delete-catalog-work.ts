import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { PUBLIC_CATALOG_BOOK } from '../../shared/private-book-access';
import { catalogEditorialRequest } from './catalog-editorial-request';
import { syncPublication } from '../publication/sync-publication';

export async function deleteCatalogWork(
  prisma: PrismaService,
  id: string,
  revision: number,
) {
  const current = (await catalogEditorialRequest({
    operation: 'get',
    kind: 'works',
    id,
  })) as {
    revision: number;
    editions: { readingAssets: { mainCatalogEntryId: string | null }[] }[];
  };
  if (current.revision !== revision)
    throw new ConflictException('Book changed; reload before deleting');
  const linkedIds = current.editions.flatMap((edition) =>
    edition.readingAssets.flatMap((asset) =>
      asset.mainCatalogEntryId ? [asset.mainCatalogEntryId] : [],
    ),
  );
  const imported = await prisma.$transaction(async (tx) => {
    const entries = await tx.catalogEntry.findMany({
      where: {
        book: { ...PUBLIC_CATALOG_BOOK, privateOwnerId: null },
        status: { not: 'ARCHIVED' },
        OR: [
          { importEvidence: { path: ['workId'], equals: id } },
          { id: { in: linkedIds } },
        ],
      },
      select: { id: true, importKey: true },
    });
    const ids = entries
      .filter((entry) => entry.importKey)
      .map((entry) => entry.id);
    await tx.catalogEntry.updateMany({
      where: { id: { in: entries.map((entry) => entry.id) } },
      data: { status: 'ARCHIVED' },
    });
    await tx.catalogEntry.updateMany({
      where: { id: { in: ids } },
      data: { importSyncPending: true, importSyncRevision: { increment: 1 } },
    });
    return ids;
  });
  const result = await catalogEditorialRequest({
    operation: 'delete',
    kind: 'works',
    id,
    revision,
  });
  for (const entryId of imported)
    await syncPublication(prisma, entryId).catch(() => undefined);
  return result;
}
