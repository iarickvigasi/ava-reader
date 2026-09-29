import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { getPdfReview } from './snapshot';
import { getPdfReviewArtifact } from './artifact';
import { listPdfReviews } from './list';
import { decidePdfReview } from './decide';
import { pdfReviewResponse } from './response';
import { PdfPublicationError } from '../publication/errors';
const denied = () => ({
  user: { findUnique: jest.fn().mockResolvedValue({ role: 'USER' }) },
  pdfImportOperation: { findFirst: jest.fn() },
  pdfCandidateValidation: { findMany: jest.fn() },
  pdfArtifact: { findFirst: jest.fn() },
});
describe('private AVA review boundary', () => {
  it.each(['snapshot', 'artifact', 'list', 'decision'])(
    'rejects ordinary reader before accessing %s evidence',
    async (kind) => {
      const fake = denied(),
        db = fake as unknown as PrismaService;
      const action =
        kind === 'snapshot'
          ? getPdfReview(db, 'reader', 'operation')
          : kind === 'artifact'
            ? getPdfReviewArtifact(db, 'reader', 'operation', 'artifact')
            : kind === 'list'
              ? listPdfReviews(db, 'reader')
              : decidePdfReview(db, 'reader', 'operation', {
                  validationId: 'candidate',
                  decision: 'APPROVE',
                  findings: [],
                });
      await expect(action).rejects.toBeInstanceOf(ForbiddenException);
      expect(fake.pdfImportOperation.findFirst).not.toHaveBeenCalled();
      expect(fake.pdfArtifact.findFirst).not.toHaveBeenCalled();
      expect(fake.pdfCandidateValidation.findMany).not.toHaveBeenCalled();
    },
  );
  it('does not leak unexpected storage errors or raw document text', async () => {
    await expect(
      pdfReviewResponse(() =>
        Promise.reject(new Error('private document text and credential')),
      ),
    ).rejects.toThrow('Review is temporarily unavailable.');
  });
  it('preserves a fixed review-policy refusal', async () => {
    await expect(
      pdfReviewResponse(() =>
        Promise.reject(new PdfPublicationError('PDF_REVIEW_HARD_BLOCKED')),
      ),
    ).rejects.toMatchObject({ response: { code: 'PDF_REVIEW_HARD_BLOCKED' } });
  });
  it('rejects arbitrary decision body fields without side effects', async () => {
    await expect(
      decidePdfReview({} as PrismaService, 'reader', 'operation', {
        validationId: 'id',
        decision: 'APPROVE',
        findings: [],
        ownerId: 'other',
      }),
    ).rejects.toThrow('Invalid review decision.');
  });
});
