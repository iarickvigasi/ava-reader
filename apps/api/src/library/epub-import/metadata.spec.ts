import type { Prisma } from '@prisma/client';
import { fixture } from '../../reader/canonical/test-fixture';
import { fillImportedMetadata } from './metadata';

async function run(input: {
  language: string | null;
  metadataUserFields: string[];
}) {
  const { book } = fixture();
  book.metadata = [];
  const findUniqueOrThrow = jest.fn().mockResolvedValue({
    id: 'book',
    title: 'My title',
    authors: ['My author'],
    metadataEditVersion: 4,
    ...input,
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

it('fills the validated English package language without an accepted source claim', async () => {
  const { updateMany, book } = await run({
    language: null,
    metadataUserFields: [],
  });
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: 'book', metadataEditVersion: 4 },
    data: { language: 'en', metadataEditVersion: { increment: 1 } },
  });
  expect(book.metadata).toEqual([]);
});
it('preserves a nonempty language', async () => {
  const { updateMany } = await run({
    language: 'en-GB',
    metadataUserFields: [],
  });
  expect(updateMany).not.toHaveBeenCalled();
});
it('preserves an explicitly cleared user language', async () => {
  const { updateMany } = await run({
    language: null,
    metadataUserFields: ['language'],
  });
  expect(updateMany).not.toHaveBeenCalled();
});
