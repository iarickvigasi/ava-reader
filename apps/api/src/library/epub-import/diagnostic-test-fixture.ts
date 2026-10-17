import { checksumBuffer } from '../../shared/blob-utils';
import { CANONICAL_EPUB_PIPELINE } from './enqueue';
export function diagnosticFixture(count = 1) {
  const bytes = Buffer.from('{}'),
    now = new Date('2026-10-11T12:00:00Z');
  const records = Array.from({ length: count }, (_, n) => ({
    id: `prepared-${n}`,
    bookId: `book-${n}`,
    ownerId: 'owner',
    libraryItemId: `item-${n}`,
    sourceFileId: `source-${n}`,
    readerFileId: `reader-${n}`,
    sourceSha256: '1'.repeat(64),
    readerSha256: checksumBuffer(bytes),
    finalContentId: `content-${n}`,
    canonicalDigest: '2'.repeat(64),
    validatorFingerprint: '3'.repeat(64),
    createdAt: new Date(now.getTime() + n),
    acceptance: null as object | null,
    readerFile: { blob: { bytes } },
    validationReport: { required_capabilities: ['text'] },
  }));
  const runs = records.map((r, n) => ({
    id: `run-${n}`,
    attemptFence: 1,
    attemptCount: 1,
    bookId: r.bookId,
    canonicalOwnerId: r.ownerId,
    canonicalLibraryItemId: r.libraryItemId,
    sourceFileId: r.sourceFileId,
    outputFileId: r.readerFileId as string | null,
    canonicalContentId: r.finalContentId,
    pipeline: CANONICAL_EPUB_PIPELINE,
    status: 'PROCESSING',
    leaseTokenHash: null as string | null,
    leaseExpiresAt: null as Date | null,
    createdAt: now,
    activeDeadlineAt: new Date(now.getTime() + 540000),
    sourceFile: {
      id: r.sourceFileId,
      bookId: r.bookId,
      kind: 'SOURCE',
      format: 'EPUB',
      blob: { checksum: r.sourceSha256, sizeBytes: bytes.length },
    },
  }));
  const investigations = new Map<string, Record<string, unknown>>();
  const events: Record<string, unknown>[] = [];
  const db = {
    $queryRaw: jest.fn((sql: { strings: string[]; values: unknown[] }) => {
      if (sql.strings.join('').includes('SELECT clock_timestamp() AS now'))
        return Promise.resolve([{ now }]);
      const cursorAt = sql.values.find((v): v is Date => v instanceof Date);
      const cursorId = cursorAt
        ? sql.values[sql.values.indexOf(cursorAt) + 1]
        : '';
      return Promise.resolve(
        records
          .filter(
            (r, n) =>
              runs[n].status === 'PROCESSING' &&
              !r.acceptance &&
              (!cursorAt ||
                r.createdAt > cursorAt ||
                (r.createdAt.getTime() === cursorAt.getTime() &&
                  r.id > String(cursorId))),
          )
          .slice(0, /LIMIT\s+1\b/.test(sql.strings.join('')) ? 1 : 16)
          .map((r) => ({
            id: r.id,
            createdAt: r.createdAt,
            runId: runs[records.indexOf(r)].id,
            fence: 1,
            deadlineAt: runs[records.indexOf(r)].activeDeadlineAt,
            observedAt: now,
          })),
      );
    }),
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(),
    libraryItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item' }) },
    canonicalEpubImport: {
      findUnique: jest.fn(
        ({ where }: { where: { id?: string; readerFileId?: string } }) =>
          Promise.resolve(
            records.find(
              (r) => r.id === where.id || r.readerFileId === where.readerFileId,
            ),
          ),
      ),
      findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(records.find((r) => r.id === where.id)),
      ),
    },
    bookProcessingRun: {
      findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(runs.find((r) => r.id === where.id)),
      ),
      updateMany: jest.fn(
        ({ where, data }: { where: Record<string, unknown>; data: object }) => {
          const run = runs.find((r) =>
            Object.entries(where).every(([key, value]) =>
              key === 'activeDeadlineAt' &&
              typeof value === 'object' &&
              value !== null &&
              'lte' in value
                ? r.activeDeadlineAt <= (value as { lte: Date }).lte
                : (r as unknown as Record<string, unknown>)[key] === value,
            ),
          );
          if (run) Object.assign(run, data);
          return Promise.resolve({ count: run ? 1 : 0 });
        },
      ),
    },
    bookFile: { update: jest.fn().mockResolvedValue({}) },
    pdfConversionInvestigation: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(investigations.get(where.id) ?? null),
      ),
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { id: string };
          create: object;
          update: object;
        }) => {
          const row = investigations.get(where.id) ?? {
            operationId: null,
            operationKey: null,
            nextSequence: 0,
            ...create,
          };
          Object.assign(row, update);
          investigations.set(where.id, row);
          return Promise.resolve({
            ...row,
            evidenceGaps: [...(row.evidenceGaps as string[])],
          });
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = investigations.get(where.id)!;
          if (data.nextSequence)
            row.nextSequence =
              Number(row.nextSequence) +
              (data.nextSequence as { increment: number }).increment;
          else Object.assign(row, data);
          return Promise.resolve({
            ...row,
            evidenceGaps: [...(row.evidenceGaps as string[])],
          });
        },
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    pdfConversionEvent: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            conversionId_producerKey: {
              conversionId: string;
              producerKey: string;
            };
          };
        }) =>
          Promise.resolve(
            events.find(
              (e) =>
                e.conversionId ===
                  where.conversionId_producerKey.conversionId &&
                e.producerKey === where.conversionId_producerKey.producerKey,
            ) ?? null,
          ),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
        return Promise.resolve(data);
      }),
    },
  };
  db.$transaction.mockImplementation((work: (tx: typeof db) => unknown) =>
    work(db),
  );
  return { db, records, runs, investigations, events, bytes };
}
