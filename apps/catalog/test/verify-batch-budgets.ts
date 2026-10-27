import assert from 'node:assert/strict';
import { batchSettings } from '../src/importer/batch-settings';
import { readApplyBatch } from '../src/importer/read-apply-batch';
import { applyRecords } from '../src/importer/apply-records';
import { recordBytes } from '../src/importer/record-groups';
import { bulkLinkedFixture } from './bulk-linked-fixture';
import type { ImportFixture } from './importer-fixtures';

export async function verifyBatchBudgets(ctx: ImportFixture) {
  const f = bulkLinkedFixture(ctx);
  try {
    const rows: [string, string, { name: string; bio: string }][] = Array.from(
      { length: 6 },
      (_, i) => [
        f.key('AUTHOR'),
        'author',
        { name: `Budget author ${i}`, bio: 'x'.repeat(i === 2 ? 2000 : 100) },
      ],
    );
    const staged = await f.stage('byte-budget', rows);
    const settings = {
      ...batchSettings({}),
      readSize: 5,
      transactionSize: 3,
      readBytes: 500,
      transactionBytes: 250,
    };
    let after: string | undefined;
    const visited: string[] = [];
    while (true) {
      const page = await readApplyBatch(
        ctx.db,
        { runId: staged.records[0].runId, kind: 'AUTHOR', after },
        undefined,
        settings,
      );
      if (!page.length) break;
      assert.ok(
        page.length === 1 ||
          page.reduce((sum, row) => sum + recordBytes(row), 0) <=
            settings.readBytes,
      );
      await applyRecords(ctx.db, page, staged.sourceId, settings);
      visited.push(...page.map((row) => row.id));
      after = page[page.length - 1].id;
    }
    assert.deepEqual(visited, staged.records.map((row) => row.id).sort());
    assert.equal(
      await ctx.db.importRecord.count({
        where: { runId: staged.records[0].runId, status: 'APPLIED' },
      }),
      6,
    );
  } finally {
    await f.cleanup();
  }
}
