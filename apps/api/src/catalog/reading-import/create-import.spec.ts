import { createImport } from './create-import';
import { classicEpubFixture } from './classic-epub.fixture';
import { importFixture } from './import-fixture';
import { checksumBuffer } from '../../shared/blob-utils';
import { buildReaderPackageFromEpub } from '../../reader/epub/epub-reader-package';
import { assessPackage } from './assess-package';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { catalogBlobRequest } from '../publication/catalog-blob-request';
jest.mock('../publication/catalog-blob-request');

it('ingests a real EPUB as a fresh public draft and produces usable reader paragraphs', async () => {
  const buffer = await classicEpubFixture();
  const checksum = checksumBuffer(buffer);
  jest.mocked(catalogBlobRequest).mockImplementation((payload) =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          id: '12345678-1234-4234-9234-123456789014',
          ...(payload as { checksum: string; sizeBytes: number }),
        }),
      ),
    ),
  );
  const manifest = {
    ...importFixture,
    checksum,
    review: { ...importFixture.review, sha256: checksum },
  };
  const create = jest
    .fn<Promise<unknown>, [Prisma.CatalogEntryCreateArgs]>()
    .mockResolvedValue({ id: 'entry' });
  const db = {
    storedBlob: { create: jest.fn().mockResolvedValue({ id: 'blob' }) },
    catalogEntry: { create },
  } as unknown as PrismaService;
  const file = {
    buffer,
    originalname: 'classic.epub',
    size: buffer.length,
  } as Express.Multer.File;
  await createImport(db, 'admin', manifest, file);
  expect(create.mock.calls[0][0].data).toMatchObject({
    status: 'DRAFT',
    book: {
      create: {
        visibility: 'PUBLIC',
        language: 'en',
        processingRuns: { create: { status: 'PENDING' } },
      },
    },
  });
  const pkg = await buildReaderPackageFromEpub({
    buffer,
    checksum,
    authors: manifest.authors,
    language: 'en',
    title: manifest.title,
  });
  expect(assessPackage(pkg, checksum).paragraphs).toBe(6);
  expect(
    pkg.chapters[0].blocks.some((block) => block.text.includes('quiet town')),
  ).toBe(true);
});
it('rejects a different edition language before storing any bytes', async () => {
  const buffer = await classicEpubFixture('ru');
  const checksum = checksumBuffer(buffer);
  const store = jest.fn();
  const db = { storedBlob: { create: store } } as unknown as PrismaService;
  await expect(
    createImport(db, 'admin', { ...importFixture, checksum }, {
      buffer,
      originalname: 'classic.epub',
      size: buffer.length,
    } as Express.Multer.File),
  ).rejects.toThrow('language');
  expect(store).not.toHaveBeenCalled();
});
