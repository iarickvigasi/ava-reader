import 'dotenv/config';
import { CatalogDatabase } from '../src/database/catalog-database';
import { seedDemo } from './seed-demo';

async function seed() {
  const db = new CatalogDatabase();
  try {
    await seedDemo(db);
    console.log('Catalog demo fixtures ready.');
  } finally {
    await db.$disconnect();
  }
}
seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
