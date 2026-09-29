// Temporary maintenance entry point. DATABASE_URL must be explicitly configured.
// Dry-run by default; --apply updates every user's existing EPUB reader packages.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { runBackfill } from './chapter-label-backfill/run-backfill';

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => arg !== '--apply' && arg !== '--dry-run') ||
    (args.includes('--apply') && args.includes('--dry-run'))
  ) {
    throw new Error(
      'Usage: db:backfill-epub-chapter-labels [--dry-run | --apply]',
    );
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is required; no default database');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    await runBackfill(prisma, args.includes('--apply'));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
