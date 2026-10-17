import type { UserRole } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';

export function reviewMembershipFixture(roles: UserRole[] | null) {
  const op = {
    id: 'operation',
    libraryItemId: 'item',
    ownerId: 'owner',
    bookId: 'book',
    status: 'WAITING',
    deletedAt: null,
    finalContentId: null,
    sourceSha256: 'source',
    configSha256: 'config',
    generation: 1,
    cancellationEpoch: 0,
  };
  const validation = {
    id: 'validation',
    operationId: op.id,
    attemptId: 'attempt',
    candidateResultSha256: 'candidate',
    sourceSha256: op.sourceSha256,
    configSha256: op.configSha256,
    generation: op.generation,
    cancellationEpoch: op.cancellationEpoch,
    attemptFence: 1,
    verdict: 'REVIEW',
    hardBlocks: [],
    reviewFindings: ['layout'],
  };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          roles === null
            ? null
            : { roleMemberships: roles.map((role) => ({ role })) },
        ),
    },
    pdfCandidateValidation: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(validation),
    },
    pdfImportOperation: {
      findUnique: jest.fn().mockResolvedValue(op),
      findUniqueOrThrow: jest.fn().mockResolvedValue(op),
    },
    pdfConversionJob: {
      findUnique: jest.fn().mockResolvedValue({
        state: 'WAITING',
        waitReason: 'REVIEW',
        currentAttemptId: 'attempt',
        attemptFence: 1,
      }),
    },
    pdfJobAttempt: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'attempt',
        status: 'CANDIDATE',
        principal: { revokedAt: null },
        fence: 1,
        resultSha256: 'candidate',
      }),
    },
    libraryItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item' }) },
    pdfReviewDecision: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: { data: unknown }) =>
        Promise.resolve(value.data),
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  } as unknown as PrismaService;
  return { tx, prisma };
}
