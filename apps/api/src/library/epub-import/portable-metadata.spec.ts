import type { MetadataClaim } from '../../pdf-conversion/contracts/generated/ava-book-2';
import { run } from './metadata-test-fixture';

const portableMetadata: MetadataClaim[] = [
  {
    id: 'portable-title',
    field: 'title',
    value: 'A reader-selected title',
    status: 'accepted',
    scope: 'work',
    origin: 'user',
  },
  {
    id: 'portable-author',
    field: 'contributor',
    contributor_role: 'author',
    value: 'A. Writer',
    status: 'accepted',
    scope: 'work',
    origin: 'user',
  },
  {
    id: 'candidate-author',
    field: 'contributor',
    contributor_role: 'author',
    value: 'Not accepted',
    status: 'candidate',
    scope: 'work',
    origin: 'source',
  },
];
it('retains accepted portable title and author regardless of original claim provenance', async () => {
  const original = structuredClone(portableMetadata);
  const { updateMany, book } = await run({
    language: 'en',
    title: 'downloaded',
    authors: [],
    metadataUserFields: [],
    metadata: portableMetadata,
  });
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: 'book', metadataEditVersion: 4 },
    data: {
      title: 'A reader-selected title',
      authors: ['A. Writer'],
      metadataEditVersion: { increment: 1 },
    },
  });
  expect(book.metadata).toEqual(original);
});
it('never overwrites or restores explicitly cleared metadata on the newly imported entry', async () => {
  const { updateMany } = await run({
    language: 'en',
    title: 'downloaded',
    authors: [],
    metadataUserFields: ['title', 'authors'],
    metadata: portableMetadata,
  });
  expect(updateMany).not.toHaveBeenCalled();
});
it('does not select an ambiguous accepted portable title', async () => {
  const metadata: MetadataClaim[] = [
    portableMetadata[0],
    {
      ...portableMetadata[0],
      id: 'conflict',
      origin: 'source',
      value: 'A different accepted title',
    },
  ];
  const { updateMany } = await run({
    language: 'en',
    title: 'downloaded',
    metadataUserFields: [],
    metadata,
  });
  expect(updateMany).not.toHaveBeenCalled();
});
