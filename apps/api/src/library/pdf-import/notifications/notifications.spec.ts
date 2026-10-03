import type { Prisma } from '@prisma/client';
import { acknowledgePdfNotification } from './acknowledge';
import { listPdfNotifications } from './list';
import type { PrismaService } from '../../../prisma/prisma.service';

const intent = {
  id: 'notice',
  operationId: 'op',
  kind: 'pdf_import_failed',
  deliveredAt: null,
  createdAt: new Date(),
  operation: { id: 'op', libraryItemId: 'item', bookId: 'book' },
};
function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    pdfNotificationIntent: {
      findUnique: jest.fn().mockResolvedValue(intent),
      findFirst: jest.fn().mockResolvedValue(intent),
      findMany: jest.fn().mockResolvedValue([intent]),
      updateMany: jest
        .fn<
          Promise<{ count: number }>,
          [Prisma.PdfNotificationIntentUpdateManyArgs]
        >()
        .mockResolvedValue({ count: 1 }),
    },
    pdfImportOperation: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'op',
        ownerId: 'owner',
        libraryItemId: 'item',
        bookId: 'book',
      }),
    },
    libraryItem: {
      findFirst: jest.fn().mockResolvedValue({ id: 'item' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'item', bookId: 'book' }]),
    },
  };
  return {
    tx,
    prisma: {
      ...tx,
      $transaction: (fn: (value: typeof tx) => unknown) => fn(tx),
    } as unknown as PrismaService,
  };
}
it('lists only owned live imports with a surviving matching library item', async () => {
  const { tx, prisma } = setup();
  expect(
    (await listPdfNotifications(prisma, 'owner')).notifications[0],
  ).toMatchObject({ id: 'notice', operationId: 'op', libraryItemId: 'item' });
  expect(tx.pdfNotificationIntent.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        acknowledgedAt: null,
        operation: { ownerId: 'owner', deletedAt: null },
      },
    }),
  );
  tx.libraryItem.findMany.mockResolvedValue([
    { id: 'item', bookId: 'different' },
  ]);
  expect((await listPdfNotifications(prisma, 'owner')).notifications).toEqual(
    [],
  );
});
it('delivery never overwrites a concurrent acknowledgement or immutable outcome', async () => {
  const { tx, prisma } = setup();
  await acknowledgePdfNotification(prisma, 'owner', 'notice', false);
  expect(tx.pdfNotificationIntent.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: 'notice',
        acknowledgedAt: null,
        deliveredAt: null,
        operation: { ownerId: 'owner', deletedAt: null },
      },
      data: expect.objectContaining({ status: 'DELIVERED' }) as unknown,
    }),
  );
});
it('acknowledges only once and refuses a deleted library entry', async () => {
  const { tx, prisma } = setup();
  await acknowledgePdfNotification(prisma, 'owner', 'notice', true);
  const update = tx.pdfNotificationIntent.updateMany.mock.calls[0][0];
  expect(update.where).toMatchObject({ acknowledgedAt: null });
  expect(update.data).toMatchObject({ status: 'ACKNOWLEDGED' });
  expect(update.data.acknowledgedAt).toBeInstanceOf(Date);
  tx.libraryItem.findFirst.mockResolvedValue(null as never);
  await expect(
    acknowledgePdfNotification(prisma, 'owner', 'notice', true),
  ).rejects.toThrow('Import not found');
});

it('preserves the first delivery timestamp read after locking the intent', async () => {
  const { tx, prisma } = setup();
  const deliveredAt = new Date('2026-09-29T09:00:00Z');
  tx.pdfNotificationIntent.findUnique.mockResolvedValue({
    ...intent,
    deliveredAt,
  } as never);
  await acknowledgePdfNotification(prisma, 'owner', 'notice', true);
  expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  expect(
    tx.pdfNotificationIntent.updateMany.mock.calls[0][0].data.deliveredAt,
  ).toBe(deliveredAt);
});
