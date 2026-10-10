import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { ownedPdfImport } from '../operations/owned-import';

export async function acknowledgePdfNotification(
  prisma: PrismaService,
  userId: string,
  id: string,
  acknowledge: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const intent = await tx.pdfNotificationIntent.findFirst({
      where: { id, operation: { ownerId: userId, deletedAt: null } },
    });
    if (!intent) throw new NotFoundException('Notification not found.');
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "PdfNotificationIntent" WHERE id=${id} FOR UPDATE`,
    );
    const current = await tx.pdfNotificationIntent.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Notification not found.');
    await ownedPdfImport(tx, userId, current.operationId);
    const now = new Date();
    await tx.pdfNotificationIntent.updateMany({
      where: {
        id,
        acknowledgedAt: null,
        ...(acknowledge ? {} : { deliveredAt: null }),
        operation: { ownerId: userId, deletedAt: null },
      },
      data: acknowledge
        ? {
            acknowledgedAt: now,
            deliveredAt: current.deliveredAt ?? now,
            status: 'ACKNOWLEDGED',
          }
        : { deliveredAt: now, status: 'DELIVERED' },
    });
    return { ok: true };
  });
}
