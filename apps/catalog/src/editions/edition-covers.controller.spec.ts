import { EditionCoversController } from './edition-covers.controller';
import type { CatalogDatabase } from '../database/catalog-database';
import type { Response } from 'express';
const edition = jest.fn();
const blob = jest.fn();
const controller = new EditionCoversController({
  edition: { findFirst: edition },
  publicBlob: { findFirst: blob },
} as unknown as CatalogDatabase);
beforeEach(() => jest.resetAllMocks());
it('only serves attached image cover blobs on visible works', async () => {
  edition.mockResolvedValue({ id: 'edition' });
  blob.mockResolvedValue({
    mimeType: 'image/jpeg',
    bytes: new Uint8Array([1, 2]),
  });
  const response = { setHeader: jest.fn(), send: jest.fn() };
  await controller.read('cover', response as unknown as Response);
  expect(edition).toHaveBeenCalledWith({
    where: {
      coverImageUrl: '/catalog/api/edition-covers/cover',
      work: { deletedAt: null },
    },
    select: { id: true },
  });
  expect(blob).toHaveBeenCalledWith({
    where: {
      id: 'cover',
      purpose: 'BOOK_COVER',
      mimeType: { in: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
    },
  });
  expect(response.send).toHaveBeenCalledWith(Buffer.from([1, 2]));
});
it('rejects unattached covers without loading any bytes', async () => {
  edition.mockResolvedValue(null);
  await expect(controller.read('cover', {} as Response)).rejects.toThrow(
    'Cover not found',
  );
  expect(blob).not.toHaveBeenCalled();
});
it('rejects sources and other non-image blobs', async () => {
  edition.mockResolvedValue({ id: 'edition' });
  blob.mockResolvedValue(null);
  await expect(controller.read('source', {} as Response)).rejects.toThrow(
    'Cover not found',
  );
});
