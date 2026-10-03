import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { importPdf } from './import-pdf';
import { checkExistingPdfImport } from './operations/check-existing';
import { inspectPdf } from './admission/inspect-pdf';
import { stagePdfSource } from './artifacts/stage-source';
import { acceptPdfImport } from './operations/accept-import';

jest.mock('./jobs/queue-capacity');
jest.mock('./operations/check-existing');
jest.mock('./admission/inspect-pdf');
jest.mock('./artifacts/stage-source');
jest.mock('./operations/accept-import');

it('snapshots exact input before the first asynchronous owner lookup', async () => {
  let resume: (value: null) => void = () => undefined;
  jest.mocked(checkExistingPdfImport).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resume = resolve;
      }),
  );
  jest.mocked(checkExistingPdfImport).mockResolvedValueOnce(null);
  jest.mocked(inspectPdf).mockResolvedValue({
    source_sha256: 'a'.repeat(64),
    page_count: 1,
    metadata: {},
    pages: [{ width: 100, height: 100 }],
  });
  const tx = { $executeRaw: jest.fn() } as unknown as Prisma.TransactionClient;
  const prisma = {
    $transaction: (callback: (client: Prisma.TransactionClient) => unknown) =>
      callback(tx),
  } as unknown as PrismaService;
  const original = Buffer.from('%PDF-1.7\nauthored');
  const file = {
    buffer: Buffer.from(original),
    size: original.length,
    originalname: 'Authored.pdf',
  } as Express.Multer.File;
  const input = {
    prisma,
    userId: 'owner-one',
    file,
    idempotencyKey: 'request_1234567890',
    convertToEpub: 'true',
  };
  const pending = importPdf(input);
  file.buffer.fill(0);
  file.originalname = 'Changed.pdf';
  input.userId = 'other-owner';
  resume(null);
  await pending;
  expect(jest.mocked(inspectPdf).mock.calls[0][0]).toEqual(original);
  expect(jest.mocked(stagePdfSource).mock.calls[0][0]).toMatchObject({
    userId: 'owner-one',
    file: { buffer: original, originalname: 'Authored.pdf' },
  });
  expect(jest.mocked(acceptPdfImport).mock.calls[0][1]).toMatchObject({
    userId: 'owner-one',
    filename: 'Authored.pdf',
  });
});
