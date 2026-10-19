import type { MetadataClaim } from '../../pdf-conversion/contracts/generated/ava-book-2';
import type { Prisma } from '@prisma/client';
import { fixture } from '../../reader/canonical/test-fixture';
import { fillImportedMetadata } from './metadata';

export async function run(input: {
  language: string | null;
  title?: string;
  authors?: string[];
  metadata?: MetadataClaim[];
  metadataUserFields: string[];
  estimatedPageCount?: number | null;
}) {
  const { book } = fixture();
  const { metadata = [], ...row } = input;
  book.metadata = metadata;
  const findUniqueOrThrow = jest.fn().mockResolvedValue({
    id: 'book',
    title: 'My title',
    authors: ['My author'],
    estimatedPageCount: 20,
    metadataEditVersion: 4,
    ...row,
  });
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  await fillImportedMetadata(
    {
      book: { findUniqueOrThrow, updateMany },
    } as unknown as Prisma.TransactionClient,
    'book',
    'downloaded.epub',
    book,
  );
  return { updateMany, book };
}
