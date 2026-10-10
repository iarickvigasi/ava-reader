import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';
import type { PrismaService } from '../../../prisma/prisma.service';
import { recordPdfReview } from '../publication/review';
import { rejectPdfCandidate } from '../publication/reject';
import { getPdfReview } from './snapshot';
const inputSchema = z
  .object({
    validationId: z.string().min(1).max(200),
    decision: z.enum(['APPROVE', 'REJECT']),
    findings: z.array(z.string().min(1).max(200)).max(10000),
  })
  .strict();
export async function decidePdfReview(
  prisma: PrismaService,
  reviewerId: string,
  operationId: string,
  raw: unknown,
) {
  const input = inputSchema.safeParse(raw);
  if (!input.success) throw new BadRequestException('Invalid review decision.');
  const snapshot = await getPdfReview(prisma, reviewerId, operationId);
  if (snapshot.validationId !== input.data.validationId)
    throw new ConflictException('Review changed.');
  await recordPdfReview(
    prisma,
    reviewerId,
    input.data.validationId,
    input.data.decision,
    input.data.findings,
  );
  if (input.data.decision === 'REJECT')
    await rejectPdfCandidate(prisma, operationId, 'INVALID_RESULT');
  return getPdfReview(prisma, reviewerId, operationId);
}
