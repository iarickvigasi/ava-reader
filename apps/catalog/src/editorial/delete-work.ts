import { ConflictException } from '@nestjs/common';
import type { CatalogDatabase } from '../database/catalog-database';

export async function deleteWork(
  db: CatalogDatabase,
  id: string,
  revision: number,
) {
  await db.$transaction(async (tx) => {
    const result = await tx.work.updateMany({
      where: { id, revision, deletedAt: null },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictException('Book changed; reload before deleting');
    await tx.readingAsset.updateMany({
      where: { edition: { workId: id } },
      data: { status: 'WITHDRAWN' },
    });
  });
  return { deleted: true };
}
