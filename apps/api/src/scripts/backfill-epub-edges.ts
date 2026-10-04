// Explicit DATABASE_URL only. No automatic .env loading or database fallback.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { runEdgeBackfill } from './chapter-edge-backfill/run-backfill';

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some(
      (arg) =>
        !['--dry-run', '--apply'].includes(arg) && !/^--book-id=.+$/.test(arg),
    ) ||
    (args.includes('--apply') && args.includes('--dry-run')) ||
    args.filter((a) => a.startsWith('--book-id=')).length > 1
  )
    throw new Error(
      'Usage: db:backfill-epub-edges [--dry-run | --apply] [--book-id=ID]',
    );
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is required; no default database');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    await runEdgeBackfill(
      prisma,
      args.includes('--apply'),
      args.find((a) => a.startsWith('--book-id='))?.slice(10),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
