import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { CANONICAL_EPUB_PIPELINE } from './enqueue';
type Candidate = {
  id: string;
  runId: string;
  fence: number;
  createdAt: Date;
  deadlineAt: Date | null;
  observedAt: Date;
};
// Fairness only: restart begins at the oldest candidate; authority is always rechecked.
const cursors = new WeakMap<
  PrismaService,
  Pick<Candidate, 'id' | 'createdAt'>
>();
export const advanceActivationCursor = (
  prisma: PrismaService,
  candidate: Candidate,
) => cursors.set(prisma, { id: candidate.id, createdAt: candidate.createdAt });
export async function activationCandidates(prisma: PrismaService) {
  const cursor = cursors.get(prisma);
  const candidates = await prisma.$queryRaw<Candidate[]>(Prisma.sql`
    SELECT i.id, i."createdAt", r.id AS "runId", r."attemptFence" AS fence, r."activeDeadlineAt" AS "deadlineAt", clock_timestamp() AS "observedAt" FROM "CanonicalEpubImport" i
    JOIN "BookProcessingRun" r ON r."bookId"=i."bookId" AND r."sourceFileId"=i."sourceFileId"
      AND r."outputFileId"=i."readerFileId" AND r."canonicalContentId"=i."finalContentId"
      AND r."canonicalOwnerId"=i."ownerId" AND r."canonicalLibraryItemId"=i."libraryItemId"
    WHERE r.pipeline=${CANONICAL_EPUB_PIPELINE} AND r.status='PROCESSING'
      AND r."leaseExpiresAt" IS NULL AND r."leaseTokenHash" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "CanonicalEpubAcceptance" a WHERE a."importId"=i.id)
      ${cursor ? Prisma.sql`AND (i."createdAt",i.id)>(${cursor.createdAt},${cursor.id})` : Prisma.empty}
    ORDER BY i."createdAt" ASC, i.id ASC LIMIT 16`);
  if (!candidates.length) cursors.delete(prisma);
  return candidates;
}
