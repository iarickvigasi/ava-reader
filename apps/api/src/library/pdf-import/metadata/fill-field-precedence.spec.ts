import { requireAttempt } from '../jobs/authority';
import { fillPdfMetadata } from './fill-metadata';
import { metadataFixture } from './test-fixture';

jest.mock('../jobs/authority');
const authority = {
  principalId: 'principal',
  token: 'token',
  attemptId: 'attempt',
  attemptToken: 'attempt-token',
};
type Write = {
  where: { metadataEditVersion: number };
  data: {
    title?: string;
    authors?: string[];
    language?: string | null;
    metadataEditVersion: { increment: number };
  };
};

function setup() {
  const fixture = metadataFixture();
  const { book, tx } = fixture;
  // Model the row CAS rather than returning success for an obsolete version.
  tx.book.updateMany.mockImplementation((write: Write) => {
    if (write.where.metadataEditVersion !== book.metadataEditVersion)
      return Promise.resolve({ count: 0 });
    Object.assign(book, {
      ...write.data,
      metadataEditVersion:
        book.metadataEditVersion + write.data.metadataEditVersion.increment,
    });
    return Promise.resolve({ count: 1 });
  });
  return fixture;
}

beforeEach(() => {
  jest
    .mocked(requireAttempt)
    .mockReset()
    .mockResolvedValue({
      attempt: { job: { operation: metadataFixture().operation } },
      job: {
        owner_id: 'owner',
        operation_id: 'operation',
        source: { sha256: 'a'.repeat(64) },
      },
    } as unknown as Awaited<ReturnType<typeof requireAttempt>>);
});

it('keeps a title edited during conversion while filling untouched source author and language', async () => {
  const { book, prisma, tx, operation } = setup();
  book.title = 'Reader title';
  book.metadataUserFields = ['title'];
  book.metadataEditVersion = 2;
  expect(
    await fillPdfMetadata(
      prisma,
      authority,
      'owner',
      'operation',
      operation.sourceSha256,
      {
        expectedVersion: 0,
        title: 'Source title',
        authors: ['Source author'],
        language: 'en',
      },
    ),
  ).toEqual({ applied: true, metadataEditVersion: 3 });
  expect(book).toMatchObject({
    title: 'Reader title',
    authors: ['Source author'],
    language: 'en',
    metadataUserFields: ['title'],
    metadataEditVersion: 3,
  });
  expect(tx.pdfMetadataClaim.createMany.mock.calls).toMatchObject([
    [
      {
        data: [
          { field: 'title', observedVersion: 0 },
          {
            field: 'authors',
            value: ['Source author'],
            observedVersion: 0,
            origin: 'extraction',
            sourceSha256: operation.sourceSha256,
          },
          { field: 'language', observedVersion: 0 },
        ],
      },
    ],
  ]);
  expect(requireAttempt).toHaveBeenCalledTimes(2);
});

it.each([{ authors: ['Reader author'] }, { authors: [] }])(
  'preserves a saved author choice or explicit clear while filling an untouched language: %j',
  async ({ authors }) => {
    const { book, prisma, operation } = setup();
    book.authors = authors;
    book.metadataUserFields = ['authors'];
    book.metadataEditVersion = 1;
    expect(
      await fillPdfMetadata(
        prisma,
        authority,
        'owner',
        'operation',
        operation.sourceSha256,
        {
          expectedVersion: 0,
          authors: ['Source author'],
          language: 'en',
        },
      ),
    ).toEqual({ applied: true, metadataEditVersion: 2 });
    expect(book).toMatchObject({
      authors,
      language: 'en',
      metadataEditVersion: 2,
    });
  },
);

it('cannot apply an impossible future observation version', async () => {
  const { book, prisma, operation } = setup();
  book.metadataEditVersion = 1;
  expect(
    await fillPdfMetadata(
      prisma,
      authority,
      'owner',
      'operation',
      operation.sourceSha256,
      {
        expectedVersion: 2,
        authors: ['Source author'],
      },
    ),
  ).toEqual({ applied: false, metadataEditVersion: 1 });
  expect(book.authors).toEqual([]);
  expect(requireAttempt).toHaveBeenCalledTimes(2);
});

it('a row change after the locked snapshot still cannot overwrite newer author intent', async () => {
  const { book, prisma, tx, operation } = setup();
  book.metadataEditVersion = 1;
  tx.book.updateMany.mockImplementation((write: Write) => {
    book.authors = ['Concurrent reader author'];
    book.metadataUserFields = ['authors'];
    book.metadataEditVersion = 2;
    return Promise.resolve({
      count: Number(
        write.where.metadataEditVersion === book.metadataEditVersion,
      ),
    });
  });
  expect(
    await fillPdfMetadata(
      prisma,
      authority,
      'owner',
      'operation',
      operation.sourceSha256,
      {
        expectedVersion: 0,
        authors: ['Source author'],
      },
    ),
  ).toEqual({ applied: false, metadataEditVersion: 1 });
  expect(book.authors).toEqual(['Concurrent reader author']);
  expect(book.metadataEditVersion).toBe(2);
  expect(requireAttempt).toHaveBeenCalledTimes(2);
});
