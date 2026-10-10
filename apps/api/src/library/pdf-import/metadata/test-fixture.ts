import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';

export function metadataFixture() {
  const operation = {
    id: 'operation',
    ownerId: 'owner',
    libraryItemId: 'library',
    bookId: 'book',
    sourceSha256: 'a'.repeat(64),
    sourceArtifactId: 'source',
    status: 'RUNNING',
  };
  const book = {
    id: 'book',
    title: 'Authored',
    authors: [] as string[],
    language: null as string | null,
    metadataEditVersion: 0,
    metadataUserFields: [] as string[],
  };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    pdfImportOperation: { findFirst: jest.fn().mockResolvedValue(operation) },
    libraryItem: { findFirst: jest.fn().mockResolvedValue({ id: 'library' }) },
    book: {
      findUniqueOrThrow: jest
        .fn()
        .mockImplementation(() => Promise.resolve({ ...book })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    pdfArtifact: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ blob: { originalFilename: 'Authored.pdf' } }),
    },
    pdfMetadataClaim: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    $transaction: (callback: (client: Prisma.TransactionClient) => unknown) =>
      callback(tx as unknown as Prisma.TransactionClient),
  } as unknown as PrismaService;
  return { prisma, tx, book, operation };
}
