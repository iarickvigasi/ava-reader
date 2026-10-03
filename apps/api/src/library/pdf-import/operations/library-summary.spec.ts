import { pdfLibrarySummary, type PdfLibraryRecord } from './library-summary';
import { observePdfImports } from './observe-imports';
import { findPdfRequest } from './find-request';
import type { PrismaService } from '../../../prisma/prisma.service';

const operation = {
  id: 'op',
  libraryItemId: 'item',
  status: 'RUNNING',
  stage: 'RECOGNIZING',
  generation: 2,
  updatedAt: new Date('2026-09-29T10:00:00Z'),
  sourceArtifactId: 'source',
  finalContentId: null,
  failureId: null,
  progressCompleted: 2,
  progressTotal: 8,
  investigationMarkedAt: null,
} satisfies PdfLibraryRecord;

describe('PDF Library status', () => {
  it('returns a bounded projection without source/provider/failure internals', () => {
    const extra = {
      ...operation,
      sourceSha256: 'private-source',
      failureReason: 'provider debug',
      configuration: { secret: 'private' },
    };
    const summary = pdfLibrarySummary(extra);
    expect(summary).toMatchObject({
      operationId: 'op',
      generation: 2,
      progress: { completed: 2, total: 8 },
    });
    expect(summary).not.toHaveProperty('configuration');
    expect(summary).not.toHaveProperty('sourceSha256');
    expect(summary).not.toHaveProperty('failureReason');
  });
  it('requires both owned operation and still-owned Library item for observations', async () => {
    const prisma = {
      pdfImportOperation: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            operation,
            { ...operation, id: 'gone', libraryItemId: 'gone-item' },
          ]),
      },
      libraryItem: { findMany: jest.fn().mockResolvedValue([{ id: 'item' }]) },
    };
    const result = await observePdfImports(
      prisma as unknown as PrismaService,
      'owner',
      'op,gone',
    );
    expect(result.imports).toHaveLength(1);
    expect(prisma.pdfImportOperation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: 'owner',
          deletedAt: null,
          id: { in: ['op', 'gone'] },
        },
      }),
    );
    expect(prisma.libraryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'owner', id: { in: ['item', 'gone-item'] } },
      }),
    );
  });
  it('caps batch identities before the database query', async () => {
    const prisma = {} as PrismaService;
    await expect(
      observePdfImports(
        prisma,
        'owner',
        Array.from({ length: 101 }, (_, i) => `id${i}`).join(','),
      ),
    ).rejects.toThrow('Invalid import identities');
  });
  it('reconciles request identity only under its owner and retains deletion', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ ...operation, deletedAt: new Date() });
    const prisma = {
      pdfImportOperation: { findUnique },
    } as unknown as PrismaService;
    await expect(findPdfRequest(prisma, 'owner', 'request')).rejects.toThrow(
      'This import was deleted',
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        ownerId_idempotencyKey: { ownerId: 'owner', idempotencyKey: 'request' },
      },
    });
  });
});
