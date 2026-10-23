import assert from 'node:assert/strict';
import type { CatalogDatabase } from '../src/database/catalog-database';
import { demo } from '../scripts/demo-data';

export async function verifyConstraints(db: CatalogDatabase) {
  const base = {
    sourceId: demo.sourceId,
    entityKind: 'WORK',
    externalId: 'invalid',
  };
  await assert.rejects(db.sourceMapping.create({ data: base }));
  await assert.rejects(
    db.sourceMapping.create({
      data: {
        ...base,
        workId: demo.workId,
        authorId: demo.authorId,
      },
    }),
  );
  await assert.rejects(
    db.sourceMapping.create({ data: { ...base, authorId: demo.authorId } }),
  );
  await assert.rejects(
    db.sourceMapping.create({
      data: {
        ...base,
        workId: '90000000-0000-4000-8000-000000000001',
      },
    }),
  );
  await assert.rejects(
    db.sourceMapping.create({
      data: {
        ...base,
        externalId: demo.workId,
        workId: demo.workId,
      },
    }),
  );
  const count = await db.sourceMapping.count({
    where: { sourceId: demo.sourceId },
  });
  assert.equal(count, 2);
}
