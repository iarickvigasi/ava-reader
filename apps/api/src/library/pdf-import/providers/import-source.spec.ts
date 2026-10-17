import type { PdfImportOperation } from '@prisma/client';
import type { Tx } from '../jobs/types';
import { requireOwnedImportSource } from './import-source';
const op = {
  id: 'op',
  ownerId: 'owner',
  sourceArtifactId: 'source',
  sourceSha256: 'a'.repeat(64),
  libraryItemId: 'item',
  bookId: 'book',
  status: 'QUEUED',
  generation: 1,
  deletedAt: null,
  finalContentId: null,
} as PdfImportOperation;
const fixture = () => ({
  pdfArtifact: { findFirst: jest.fn().mockResolvedValue({ id: 'source' }) },
  libraryItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item' }) },
});
it('requires the exact original artifact and owned Library identity', async () => {
  const tx = fixture();
  await requireOwnedImportSource(tx as unknown as Tx, op);
  expect(tx.pdfArtifact.findFirst).toHaveBeenCalledWith({
    where: {
      id: 'source',
      operationId: 'op',
      ownerId: 'owner',
      checksum: 'a'.repeat(64),
      role: 'SOURCE_PDF',
    },
  });
  expect(tx.libraryItem.findFirst).toHaveBeenCalledWith({
    where: {
      id: 'item',
      userId: 'owner',
      bookId: 'book',
    },
  });
});
it.each([
  { status: 'FAILED' },
  { status: 'READY' },
  { generation: 2 },
  { deletedAt: new Date() },
  { finalContentId: 'finished' },
])('never authorizes later replacement %j', async (change) => {
  await expect(
    requireOwnedImportSource(
      fixture() as unknown as Tx,
      { ...op, ...change } as PdfImportOperation,
    ),
  ).rejects.toThrow();
});
it('rejects missing artifact or other owner Library membership', async () => {
  for (const key of ['pdfArtifact', 'libraryItem'] as const) {
    const tx = fixture();
    tx[key].findFirst.mockResolvedValue(null);
    await expect(
      requireOwnedImportSource(tx as unknown as Tx, op),
    ).rejects.toThrow();
  }
});
