import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
export async function requirePdfReviewer(
  prisma: PrismaService,
  reviewerId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { roleMemberships: { select: { role: true } } },
  });
  if (!user?.roleMemberships.some((membership) => membership.role === 'ADMIN'))
    throw new ForbiddenException('AVA reviewer access required.');
}
export async function pdfReviewScope(
  prisma: PrismaService,
  reviewerId: string,
  operationId: string,
) {
  await requirePdfReviewer(prisma, reviewerId);
  const op = await prisma.pdfImportOperation.findFirst({
    where: { id: operationId, deletedAt: null },
    include: {
      book: { select: { title: true } },
      validations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { review: true },
      },
    },
  });
  if (
    !op ||
    !(await prisma.libraryItem.findFirst({
      where: { id: op.libraryItemId, userId: op.ownerId, bookId: op.bookId },
    }))
  )
    throw new NotFoundException('Review not found.');
  const validation = op.validations[0];
  if (!validation) throw new NotFoundException('Review not found.');
  return { op, validation };
}
