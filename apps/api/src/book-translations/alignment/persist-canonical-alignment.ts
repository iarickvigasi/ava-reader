import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { TranslationContext } from '../types';
import { assertCanonicalTranslationAuthority } from '../source/assert-canonical-authority';
export async function persistCanonicalAlignment(
  prisma: PrismaService,
  context: TranslationContext | undefined,
  write: (
    tx: Pick<Prisma.TransactionClient, 'sentenceTranslation'>,
  ) => Promise<{ count: number }>,
) {
  if (!context?.canonicalAuthority) return write(prisma);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${context.libraryItemId}, 0))`,
    );
    await assertCanonicalTranslationAuthority(tx, context);
    const saved = await write(tx);
    await assertCanonicalTranslationAuthority(tx, context);
    return saved;
  });
}
