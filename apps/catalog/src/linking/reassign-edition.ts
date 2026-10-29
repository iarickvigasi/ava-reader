import { ConflictException, NotFoundException } from '@nestjs/common';
import type { CatalogDatabase } from '../database/catalog-database';
export async function reassignEdition(
  db: CatalogDatabase,
  editionId: string,
  workId: string,
  revision: number,
  workRevision: number,
) {
  return db.$transaction(async (tx) => {
    // Serialize reassignment against work deletion and concurrent edition changes.
    await tx.$queryRaw`SELECT id FROM "Work" WHERE id = ${workId}::uuid FOR UPDATE`;
    const work = await tx.work.findUnique({
      where: { id: workId, deletedAt: null },
    });
    if (!work) throw new NotFoundException('Target work not found');
    if (work.revision !== workRevision)
      throw new ConflictException('Work changed; choose it again');
    const edition = await tx.edition.findUniqueOrThrow({
      where: { id: editionId },
    });
    if (edition.workId === workId) return { editionId, workId };
    const updated = await tx.edition.updateMany({
      where: { id: editionId, revision },
      data: { workId, revision: { increment: 1 } },
    });
    if (!updated.count)
      throw new ConflictException('Edition changed; reload before linking');
    await tx.catalogOutbox.create({
      data: {
        kind: 'EDITION',
        entityId: editionId,
        revision: revision + 1,
        eventType: 'WORK_LINK_CHANGED',
      },
    });
    return { editionId, workId };
  });
}
