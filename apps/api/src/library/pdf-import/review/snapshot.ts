import { reviewVerdict, reviewDecision } from './parse-record';
import { ConflictException } from '@nestjs/common';
import type { PdfArtifact } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { pdfReviewScope, requirePdfReviewer } from './scope';
import type { PdfReviewFile, PdfReviewSnapshot } from './types';
export async function getPdfReview(
  prisma: PrismaService,
  reviewerId: string,
  operationId: string,
): Promise<PdfReviewSnapshot> {
  const { op, validation: v } = await pdfReviewScope(
    prisma,
    reviewerId,
    operationId,
  );
  const artifacts = await prisma.pdfArtifact.findMany({
    where: { operationId, ownerId: op.ownerId },
  });
  const file = (id: string, role: PdfArtifact['role']): PdfReviewFile => {
    const a = artifacts.find(
      (a) =>
        a.id === id &&
        a.role === role &&
        ['OPERATION', 'ACCEPTED'].includes(a.retention),
    );
    if (!a) throw new ConflictException('Review evidence is unavailable.');
    return {
      artifactId: a.id,
      sha256: a.checksum,
      byteLength: a.sizeBytes,
      mediaType: a.mimeType,
      url: `/api/admin/pdf-imports/${encodeURIComponent(operationId)}/review/artifacts/${encodeURIComponent(a.id)}`,
    };
  };
  const map = v.resourceMap;
  if (
    !map ||
    typeof map !== 'object' ||
    Array.isArray(map) ||
    Object.values(map).some((id) => typeof id !== 'string')
  )
    throw new ConflictException('Review evidence is unavailable.');
  const result: PdfReviewSnapshot = {
    operationId,
    title: op.book.title,
    status: op.status,
    validationId: v.id,
    verdict: reviewVerdict.parse(v.verdict),
    hardBlocks: v.hardBlocks,
    reviewFindings: v.reviewFindings,
    createdAt: v.createdAt.toISOString(),
    decision: v.review
      ? {
          decision: reviewDecision.parse(v.review.decision),
          findings: v.review.approvedFindings,
          decidedAt: v.review.createdAt.toISOString(),
        }
      : null,
    source: file(op.sourceArtifactId, 'SOURCE_PDF'),
    candidate: file(v.epubArtifactId, 'DERIVED_EPUB'),
    canonical: file(v.canonicalArtifactId, 'CANONICAL_BOOK'),
    report: file(v.reportArtifactId, 'VALIDATION_REPORT'),
    resources: Object.entries(map).map(([resourceId, id]) => ({
      resourceId,
      ...file(id as string, 'RESOURCE'),
    })),
  };
  await requirePdfReviewer(prisma, reviewerId);
  const fresh = await pdfReviewScope(prisma, reviewerId, operationId);
  if (fresh.validation.id !== v.id)
    throw new ConflictException('Review changed.');
  return result;
}
