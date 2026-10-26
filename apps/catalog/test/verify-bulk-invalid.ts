import assert from 'node:assert/strict';
import { applyRecords } from '../src/importer/apply-records';
import { bulkAuthorFixture } from './bulk-author-fixture';
import type { ImportFixture } from './importer-fixtures';

export async function verifyBulkInvalid(ctx: ImportFixture) {
  const fixture = await bulkAuthorFixture(ctx, true);
  try {
    const result = await applyRecords(
      ctx.db,
      fixture.records,
      fixture.sourceId,
    );
    assert.equal(result.bulkRecords, 0);
    assert.equal(result.fallbackRecords, 3);
    const mappings = await ctx.db.sourceMapping.findMany({
      where: { sourceId: fixture.sourceId, externalId: { in: fixture.keys } },
    });
    assert.equal(mappings.length, 2);
    assert.ok(mappings.every((row) => row.externalId !== fixture.keys[1]));
    const outcomes = await ctx.db.importRecord.findMany({
      where: { id: { in: fixture.records.map((row) => row.id) } },
      orderBy: { line: 'asc' },
    });
    assert.deepEqual(
      outcomes.map((row) => row.status),
      ['APPLIED', 'INVALID', 'APPLIED'],
    );
  } finally {
    await fixture.cleanup();
  }
}
