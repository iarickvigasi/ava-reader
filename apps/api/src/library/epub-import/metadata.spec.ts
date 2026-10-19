import { run } from './metadata-test-fixture';

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

it('fills the original PDF page count from the validated embedded source', async () => {
  const { updateMany, book } = await run({
    language: 'en',
    metadataUserFields: [],
    estimatedPageCount: null,
  });
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: 'book', metadataEditVersion: 4 },
    data: {
      estimatedPageCount: book.source.page_count,
      metadataEditVersion: { increment: 1 },
    },
  });
});
it('preserves a reader-edited page count, including an explicitly cleared value', async () => {
  const { updateMany } = await run({
    language: 'en',
    metadataUserFields: ['estimatedPageCount'],
    estimatedPageCount: null,
  });
  expect(updateMany).not.toHaveBeenCalled();
});
