import { reviewVerdict } from './parse-record';
import type { PrismaService } from '../../../prisma/prisma.service';
import { requirePdfReviewer } from './scope';
import type { PdfReviewSummary } from './types';
export async function listPdfReviews(
  prisma: PrismaService,
  reviewerId: string,
) {
  await requirePdfReviewer(prisma, reviewerId);
  const rows = await prisma.pdfCandidateValidation.findMany({
    where: { operation: { deletedAt: null, status: 'WAITING' } },
    include: { operation: { include: { book: { select: { title: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const seen = new Set<string>(),
    reviews: PdfReviewSummary[] = [];
  for (const v of rows) {
    if (seen.has(v.operationId)) continue;
    seen.add(v.operationId);
    if (
      !(await prisma.libraryItem.findFirst({
        where: {
          id: v.operation.libraryItemId,
          userId: v.operation.ownerId,
          bookId: v.operation.bookId,
        },
      }))
    )
      continue;
    reviews.push({
      operationId: v.operationId,
      title: v.operation.book.title,
      status: v.operation.status,
      validationId: v.id,
      verdict: reviewVerdict.parse(v.verdict),
      hardBlocks: v.hardBlocks,
      reviewFindings: v.reviewFindings,
      createdAt: v.createdAt.toISOString(),
    });
  }
  await requirePdfReviewer(prisma, reviewerId);
  return { reviews };
}
