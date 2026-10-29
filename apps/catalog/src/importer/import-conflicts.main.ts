import 'dotenv/config';
import { parseArgs } from 'node:util';
import { CatalogDatabase } from '../database/catalog-database';
import { importConflicts } from './import-conflicts';
async function main() {
  const { values } = parseArgs({ options: { after: { type: 'string' } } });
  const db = new CatalogDatabase();
  try {
    console.log(
      JSON.stringify(await importConflicts(db, values.after), null, 2),
    );
  } finally {
    await db.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Conflict report failed',
  );
  process.exitCode = 1;
});
