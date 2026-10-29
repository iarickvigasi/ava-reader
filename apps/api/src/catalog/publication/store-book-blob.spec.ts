import { storeBookBlob } from './store-book-blob';
import { catalogBlobRequest } from './catalog-blob-request';
import { readStoredBlob } from './read-stored-blob';
import { checksumBuffer } from '../../shared/blob-utils';
import type { PrismaService } from '../../prisma/prisma.service';

jest.mock('./catalog-blob-request');
const create = jest.fn();
const db = { storedBlob: { create } } as unknown as PrismaService;
const bytes = Buffer.from('public EPUB source bytes');
const data = {
  purpose: 'BOOK_SOURCE' as const,
  mimeType: 'application/epub+zip',
  sizeBytes: bytes.length,
  originalFilename: 'classic.epub',
  checksum: checksumBuffer(bytes),
  bytes: Uint8Array.from(bytes),
};
beforeEach(() => jest.resetAllMocks());
it('stores public bytes in Catalog and only an empty-byte descriptor in main', async () => {
  jest.mocked(catalogBlobRequest).mockResolvedValue(
    new Response(
      JSON.stringify({
        id: '12345678-1234-4234-9234-123456789014',
        checksum: data.checksum,
        sizeBytes: bytes.length,
      }),
    ),
  );
  await storeBookBlob(db, true, { data });
  expect(catalogBlobRequest).toHaveBeenCalledWith(
    expect.objectContaining({ checksum: data.checksum }),
    bytes,
  );
  expect(create).toHaveBeenCalledWith({
    data: {
      ...data,
      bytes: new Uint8Array(),
      catalogBlobId: '12345678-1234-4234-9234-123456789014',
    },
  });
});
it('keeps private upload bytes in main without contacting Catalog', async () => {
  await storeBookBlob(db, false, { data });
  expect(catalogBlobRequest).not.toHaveBeenCalled();
  expect(create).toHaveBeenCalledWith({ data });
});
it('never falls back to main byte persistence if Catalog is unavailable', async () => {
  jest
    .mocked(catalogBlobRequest)
    .mockRejectedValue(new Error('Catalog offline'));
  await expect(storeBookBlob(db, true, { data })).rejects.toThrow('offline');
  expect(create).not.toHaveBeenCalled();
});
it('loads remote public bytes and rejects corrupted content', async () => {
  jest.mocked(catalogBlobRequest).mockResolvedValue(new Response(bytes));
  expect(
    await readStoredBlob({
      bytes: new Uint8Array(),
      catalogBlobId: 'remote',
      checksum: data.checksum,
    }),
  ).toEqual(bytes);
  jest.mocked(catalogBlobRequest).mockResolvedValue(new Response('corrupt'));
  await expect(
    readStoredBlob({
      bytes: new Uint8Array(),
      catalogBlobId: 'remote',
      checksum: data.checksum,
    }),
  ).rejects.toThrow('checksum');
});
