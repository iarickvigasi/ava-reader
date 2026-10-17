import { epubLibrarySummary, type EpubLibraryBook } from './library-summary';

const prepared = (): EpubLibraryBook => ({
  canonicalImportPrivate: true,
  processingRuns: [
    {
      id: 'run',
      status: 'PROCESSING',
      updatedAt: new Date('2026-10-15T10:00:00Z'),
    },
  ],
  canonicalEpubImport: {
    finalContentId: 'content',
    readerSha256: 'checksum',
    acceptance: null,
    readerFile: {
      kind: 'DERIVED_READER',
      format: 'READER_PACKAGE',
      isPrimary: false,
      processingStatus: 'PROCESSING',
      updatedAt: new Date('2026-10-15T10:01:00Z'),
      blob: { checksum: 'checksum' },
    },
  },
});
const accepted = () => {
  const book = prepared();
  const record = book.canonicalEpubImport!;
  record.acceptance = { createdAt: new Date('2026-10-15T10:02:00Z') };
  record.readerFile.isPrimary = true;
  record.readerFile.processingStatus = 'READY';
  book.processingRuns![0].status = 'READY';
  return book;
};

describe('canonical EPUB library readiness', () => {
  it('leaves ordinary EPUB and PDF behavior unchanged', () => {
    expect(epubLibrarySummary({})).toBeNull();
    expect(epubLibrarySummary({ canonicalImportPrivate: false })).toBeNull();
  });
  it('never treats a missing run or a ready run without output as readable', () => {
    expect(epubLibrarySummary({ canonicalImportPrivate: true })).toMatchObject({
      status: 'PENDING',
      finalContentId: null,
    });
    const book = accepted();
    book.canonicalEpubImport = null;
    expect(epubLibrarySummary(book)).toMatchObject({
      status: 'PENDING',
      finalContentId: null,
    });
  });
  it('distinguishes pending, processing, prepared and failed', () => {
    const book = prepared();
    expect(epubLibrarySummary(book)?.status).toBe('AWAITING_ACCEPTANCE');
    book.canonicalEpubImport = null;
    expect(epubLibrarySummary(book)?.status).toBe('PROCESSING');
    book.processingRuns![0].status = 'PENDING';
    expect(epubLibrarySummary(book)?.status).toBe('PENDING');
    book.processingRuns![0].status = 'FAILED';
    expect(epubLibrarySummary(book)?.status).toBe('FAILED');
  });
  it('keeps a refused prepared result failed', () => {
    const book = prepared();
    book.processingRuns![0].status = 'FAILED';
    expect(epubLibrarySummary(book)).toMatchObject({
      status: 'FAILED',
      finalContentId: null,
    });
  });
  it('requires acceptance and an available matching primary reader', () => {
    expect(epubLibrarySummary(accepted())).toEqual({
      status: 'READY',
      runId: 'run',
      updatedAt: '2026-10-15T10:02:00.000Z',
      finalContentId: 'content',
    });
    for (const change of [
      (record: NonNullable<EpubLibraryBook['canonicalEpubImport']>) => {
        record.acceptance = null;
      },
      (record: NonNullable<EpubLibraryBook['canonicalEpubImport']>) => {
        record.readerFile.isPrimary = false;
      },
      (record: NonNullable<EpubLibraryBook['canonicalEpubImport']>) => {
        record.readerFile.processingStatus = 'FAILED';
      },
      (record: NonNullable<EpubLibraryBook['canonicalEpubImport']>) => {
        record.readerFile.blob.checksum = 'different';
      },
    ]) {
      const book = accepted();
      change(book.canonicalEpubImport!);
      expect(epubLibrarySummary(book)?.finalContentId).toBeNull();
      expect(epubLibrarySummary(book)?.status).toBe(
        book.canonicalEpubImport?.acceptance ? 'FAILED' : 'AWAITING_ACCEPTANCE',
      );
    }
  });
});
