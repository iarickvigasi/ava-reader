import { refusePreparedEpub } from './refuse-prepared';
import { PdfPublicationError } from '../pdf-import/publication/errors';
import type { PrismaService } from '../../prisma/prisma.service';
import { requireReaderQualification } from '../pdf-import/publication/qualification';
import { validateContract } from '../../pdf-conversion/contracts/validate-contract';
import { activateImportedRecord } from './activate-record';
import { activateCanonicalEpub } from './activate';
import { diagnosticFixture } from './diagnostic-test-fixture';
jest.mock('../pdf-import/publication/qualification');
jest.mock('../../pdf-conversion/contracts/validate-contract');
jest.mock('./activate-record');
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(requireReaderQualification)
    .mockResolvedValue({ capabilities: ['text'] } as never);
  jest
    .mocked(validateContract)
    .mockResolvedValue({ required_capabilities: ['text'] } as never);
  jest.mocked(activateImportedRecord).mockResolvedValue(true);
});
it('atomically refuses an oldest corrupt candidate and progresses a later eligible book', async () => {
  const { db, records, runs, events } = diagnosticFixture(2);
  records[0].readerSha256 = '0'.repeat(64);
  await expect(
    activateCanonicalEpub(
      db as unknown as PrismaService,
      () => Promise.resolve(true),
      'qualified',
    ),
  ).resolves.toBe(true);
  expect(runs[0].status).toBe('FAILED');
  expect(db.bookProcessingRun.updateMany.mock.calls[0][0].where).toMatchObject({
    id: 'run-0',
    status: 'PROCESSING',
    attemptFence: 1,
    leaseTokenHash: null,
    leaseExpiresAt: null,
  });
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: 'FAILED',
      code: 'PREPARED_CONTENT_CHANGED',
    }),
  );
  expect(activateImportedRecord).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: 'prepared-1' }),
    expect.anything(),
    'qualified',
  );
});

it('retries a transient activation using the exact prepared bytes without a new preparation attempt', async () => {
  const { db, records, runs, bytes, events } = diagnosticFixture();
  jest
    .mocked(activateImportedRecord)
    .mockRejectedValueOnce(new Error('database unavailable'))
    .mockImplementationOnce(() => {
      runs[0].status = 'READY';
      records[0].acceptance = { id: 'only-acceptance' };
      return Promise.resolve(true);
    });
  const client = db as unknown as PrismaService,
    semantic = () => Promise.resolve(true);
  expect(await activateCanonicalEpub(client, semantic, 'qualified')).toBe(
    false,
  );
  expect(runs[0].status).toBe('PROCESSING');
  expect(db.bookProcessingRun.updateMany).not.toHaveBeenCalled();
  // The exhausted keyset wraps once, then the same candidate is tried.
  expect(await activateCanonicalEpub(client, semantic, 'qualified')).toBe(
    false,
  );
  expect(await activateCanonicalEpub(client, semantic, 'qualified')).toBe(true);
  expect(await activateCanonicalEpub(client, semantic, 'qualified')).toBe(
    false,
  );
  expect(activateImportedRecord).toHaveBeenCalledTimes(2);
  expect(records[0].readerFile.blob.bytes).toBe(bytes);
  expect(runs[0]).toMatchObject({
    attemptCount: 1,
    attemptFence: 1,
    outputFileId: 'reader-0',
  });
  expect(events.filter((e) => e.kind === 'PUBLISHED')).toHaveLength(1);
  expect(events).toContainEqual(
    expect.objectContaining({ code: 'ACTIVATION_UNAVAILABLE' }),
  );
});
it('lets a seventeenth eligible candidate progress past sixteen transiently unavailable candidates', async () => {
  const { db, records } = diagnosticFixture(17);
  jest.mocked(activateImportedRecord).mockImplementation((_client, record) => {
    if (record.id !== records[16].id) throw new Error('unavailable');
    return Promise.resolve(true);
  });
  const client = db as unknown as PrismaService,
    semantic = () => Promise.resolve(true);
  expect(await activateCanonicalEpub(client, semantic, 'qualified')).toBe(
    false,
  );
  expect(await activateCanonicalEpub(client, semantic, 'qualified')).toBe(true);
  expect(activateImportedRecord).toHaveBeenCalledTimes(17);
});
it('keeps a qualification outage retryable and excludes FAILED or already accepted content', async () => {
  const { db, records, runs, events } = diagnosticFixture(3);
  runs[1].status = 'FAILED';
  records[2].acceptance = { id: 'accepted' };
  jest
    .mocked(requireReaderQualification)
    .mockRejectedValue(new PdfPublicationError('PDF_READER_NOT_QUALIFIED'));
  expect(
    await activateCanonicalEpub(
      db as unknown as PrismaService,
      () => Promise.resolve(true),
      'qualified',
    ),
  ).toBe(false);
  expect(runs[0].status).toBe('PROCESSING');
  expect(events).toContainEqual(
    expect.objectContaining({ code: 'READER_NOT_QUALIFIED' }),
  );
  expect(activateImportedRecord).not.toHaveBeenCalled();
  expect(db.bookProcessingRun.updateMany).not.toHaveBeenCalled();
});

it('does not fail a stale fence or a candidate accepted during validation', async () => {
  const { db, records, runs } = diagnosticFixture();
  const client = db as unknown as PrismaService;
  runs[0].attemptFence = 2;
  expect(
    await refusePreparedEpub(client, records[0] as never, 'run-0', 1),
  ).toBe(false);
  expect(runs[0].status).toBe('PROCESSING');
  expect(db.bookFile.update).not.toHaveBeenCalled();
  runs[0].attemptFence = 1;
  records[0].acceptance = { id: 'already-accepted' };
  runs[0].status = 'READY';
  expect(
    await refusePreparedEpub(client, records[0] as never, 'run-0', 1),
  ).toBe(false);
  expect(runs[0].status).toBe('READY');
  expect(db.bookFile.update).not.toHaveBeenCalled();
});
it('ends transient validator/activation recovery at the existing active deadline', async () => {
  const { db, records, runs, events } = diagnosticFixture(2);
  runs[0].activeDeadlineAt = new Date('2026-10-11T11:59:59.000Z');
  jest.mocked(activateImportedRecord).mockImplementation((_client, record) => {
    if (record.id === records[0].id) throw new Error('activation unavailable');
    return Promise.resolve(true);
  });
  expect(
    await activateCanonicalEpub(
      db as unknown as PrismaService,
      () => Promise.resolve(true),
      'qualified',
    ),
  ).toBe(true);
  expect(runs[0].status).toBe('FAILED');
  expect(events).toContainEqual(
    expect.objectContaining({
      code: 'ACTIVE_DEADLINE_EXPIRED',
      kind: 'FAILED',
    }),
  );
  expect(runs[1].status).toBe('PROCESSING');
});
it('keeps qualification waiting separate from bounded transient failure even past the preparation deadline', async () => {
  const { db, runs } = diagnosticFixture();
  runs[0].activeDeadlineAt = new Date('2026-10-11T11:59:59.000Z');
  jest
    .mocked(requireReaderQualification)
    .mockRejectedValue(new PdfPublicationError('PDF_READER_NOT_QUALIFIED'));
  expect(
    await activateCanonicalEpub(
      db as unknown as PrismaService,
      () => Promise.resolve(true),
      'qualified',
    ),
  ).toBe(false);
  expect(runs[0].status).toBe('PROCESSING');
  expect(db.bookProcessingRun.updateMany).not.toHaveBeenCalled();
});
it('contains a failed prepared-record read and still progresses a later book', async () => {
  const { db, events } = diagnosticFixture(2);
  db.canonicalEpubImport.findUniqueOrThrow.mockRejectedValueOnce(
    new Error('read unavailable'),
  );
  expect(
    await activateCanonicalEpub(
      db as unknown as PrismaService,
      () => Promise.resolve(true),
      'qualified',
    ),
  ).toBe(true);
  expect(events).toContainEqual(
    expect.objectContaining({ code: 'PREPARED_RECORD_UNAVAILABLE' }),
  );
  expect(activateImportedRecord).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: 'prepared-1' }),
    expect.anything(),
    'qualified',
  );
});
