import { performance } from 'node:perf_hooks';
import { batchSettings } from '../src/importer/batch-settings';
import { readApplyBatch } from '../src/importer/read-apply-batch';
import { applyRecords } from '../src/importer/apply-records';
import { bulkLinkedFixture } from './bulk-linked-fixture';
import type { ImportFixture } from './importer-fixtures';
import type { Kind, Raw } from '../src/importer/types';

export async function measureImportBatch(
  ctx: ImportFixture,
  kind: Kind,
  size: number,
  round: number,
) {
  const f = bulkLinkedFixture(ctx);
  try {
    const author = f.key('AUTHOR'),
      work = f.key('WORK');
    await f.apply(`setup-author-${kind}-${size}-${round}`, [
      [author, 'author', { name: 'Benchmark parent' }],
    ]);
    await f.apply(`setup-work-${kind}-${size}-${round}`, [
      [work, 'work', { title: 'Benchmark parent work' }],
    ]);
    const raw: Raw =
      kind === 'AUTHOR'
        ? {
            name: 'Benchmark author',
            alternate_names: ['Alias'],
            bio: 'Biography'.repeat(50),
          }
        : kind === 'WORK'
          ? {
              title: 'Benchmark work',
              authors: [{ key: author }],
              subjects: ['Fiction'],
              description: 'Description'.repeat(50),
            }
          : {
              title: 'Benchmark edition',
              works: [{ key: work }],
              authors: [{ key: author }],
              isbn_13: ['9780306406157'],
              publishers: ['Publisher'],
            };
    const rows: [string, string, Raw][] = Array.from({ length: 500 }, () => [
      f.key(kind),
      kind.toLowerCase(),
      raw,
    ]);
    const staged = await f.stage(`measure-${kind}-${size}-${round}`, rows);
    const settings = {
      ...batchSettings({}),
      readSize: Math.min(size * 2, 500),
      transactionSize: size,
    };
    let after: string | undefined,
      records = 0,
      transactions = 0;
    const started = performance.now();
    while (true) {
      const page = await readApplyBatch(
        ctx.db,
        { runId: staged.records[0].runId, kind, after },
        undefined,
        settings,
      );
      if (!page.length) break;
      const metrics = await applyRecords(
        ctx.db,
        page,
        staged.sourceId,
        settings,
      );
      records += page.length;
      transactions += metrics.transactions;
      after = page[page.length - 1].id;
    }
    const elapsedMs = performance.now() - started;
    console.log(
      JSON.stringify({
        event: 'importBenchmark',
        kind,
        round,
        ...settings,
        records,
        transactions,
        elapsedMs,
        recordsPerSecond: (records * 1000) / elapsedMs,
        rssBytes: process.memoryUsage().rss,
      }),
    );
  } finally {
    await f.cleanup();
  }
}
