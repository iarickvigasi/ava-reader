import type { PrismaService } from '../../../prisma/prisma.service';

export async function listPdfNotifications(
  prisma: PrismaService,
  userId: string,
) {
  const intents = await prisma.pdfNotificationIntent.findMany({
    where: {
      acknowledgedAt: null,
      operation: { ownerId: userId, deletedAt: null },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 100,
    select: {
      id: true,
      kind: true,
      createdAt: true,
      deliveredAt: true,
      operation: { select: { id: true, libraryItemId: true, bookId: true } },
    },
  });
  const items = await prisma.libraryItem.findMany({
    where: {
      userId,
      id: { in: intents.map((intent) => intent.operation.libraryItemId) },
    },
    select: { id: true, bookId: true },
  });
  const owned = new Map(items.map((item) => [item.id, item.bookId]));
  return {
    complete: intents.length < 100,
    notifications: intents
      .filter(
        (intent) =>
          owned.get(intent.operation.libraryItemId) === intent.operation.bookId,
      )
      .map((intent) => ({
        id: intent.id,
        kind: intent.kind,
        operationId: intent.operation.id,
        libraryItemId: intent.operation.libraryItemId,
        createdAt: intent.createdAt.toISOString(),
        deliveredAt: intent.deliveredAt?.toISOString() ?? null,
      })),
  };
}
