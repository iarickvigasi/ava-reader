import 'dotenv/config';
import { CatalogDatabase } from '../database/catalog-database';
import { rebuildCategories } from './rebuild-categories';

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply') || args.length > 1)
    throw new Error('Usage: categories:rebuild [--apply]; default is dry-run');
  const db = new CatalogDatabase();
  try {
    const report = await rebuildCategories(db, args.includes('--apply'));
    console.log(JSON.stringify(report, null, 2));
    if (report.conflicts) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
