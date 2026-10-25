import 'dotenv/config';
import { parseArgs } from 'node:util';
import { CatalogDatabase } from '../database/catalog-database';
import { runImport } from './run-import';
import { IMPORT_STATEMENT_TIMEOUT_MS } from './types';

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      retry: { type: 'boolean', default: false },
    },
  });
  if (Boolean(values.file) === Boolean(values.retry)) {
    throw new Error('Use --file /path/dump.txt[.gz] or --retry');
  }
  const db = new CatalogDatabase(IMPORT_STATEMENT_TIMEOUT_MS);
  try {
    const summary = await runImport(db, values.file);
    console.log(JSON.stringify(summary, null, 2));
    if ((summary.counts.INVALID ?? 0) + (summary.counts.CONFLICT ?? 0))
      process.exitCode = 2;
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
