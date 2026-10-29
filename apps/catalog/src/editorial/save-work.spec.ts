import type { CatalogDatabase } from '../database/catalog-database';
import { saveWork } from './save-work';

const tx = {
  work: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'work' }),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  workText: { deleteMany: jest.fn(), createMany: jest.fn() },
  workCredit: { deleteMany: jest.fn(), createMany: jest.fn() },
};
const db = {
  ...tx,
  $transaction: jest.fn((operation: (tx: unknown) => unknown) => operation(tx)),
} as unknown as CatalogDatabase;
const data = {
  originalTitle: 'Corrected title',
  originalLanguage: 'uk',
  coverImageUrl: null,
  subjects: ['Literature'],
  categories: ['fiction'],
  texts: [{ locale: 'uk', title: 'Назва', description: 'Опис' }],
  credits: [],
  deletedAt: new Date(),
  sourceMappings: [],
};
beforeEach(() => {
  jest.clearAllMocks();
  tx.work.updateMany.mockResolvedValue({ count: 1 });
  tx.work.findUnique.mockResolvedValue({ id: 'work' });
});
it('rejects stale revisions before replacing texts or credits', async () => {
  tx.work.updateMany.mockResolvedValue({ count: 0 });
  await expect(saveWork(db, 'work', 4, data)).rejects.toThrow('reload');
  expect(tx.workText.deleteMany).not.toHaveBeenCalled();
  expect(tx.workCredit.deleteMany).not.toHaveBeenCalled();
});
it('writes whitelisted metadata and increments revision without accepting provenance or deletion fields', async () => {
  await saveWork(db, 'work', 4, data);
  const call = tx.work.updateMany.mock.calls[0] as [
    { data: Record<string, unknown>; where: unknown },
  ];
  expect(call[0].where).toEqual({ id: 'work', revision: 4, deletedAt: null });
  expect(call[0].data.revision).toEqual({ increment: 1 });
  expect(call[0].data).not.toHaveProperty('deletedAt');
  expect(call[0].data).not.toHaveProperty('sourceMappings');
  expect(tx.workText.createMany).toHaveBeenCalledWith({
    data: [
      { workId: 'work', locale: 'uk', title: 'Назва', description: 'Опис' },
    ],
  });
});
