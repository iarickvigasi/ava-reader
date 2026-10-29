import 'dotenv/config';
import { CatalogDatabase } from '../database/catalog-database';
import { readingOptions } from './reading-options';
import { runReadingCommand } from './run-reading-command';
async function main() {
  const values = readingOptions();
  const db = new CatalogDatabase(60_000);
  try {
    const result = await runReadingCommand(db, values);
    console.log(JSON.stringify(result));
    if ('failures' in result && (result.failures || result.pending))
      process.exitCode = 2;
  } finally {
    await db.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Reading import failed',
  );
  process.exitCode = 1;
});
