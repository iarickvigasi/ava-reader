import * as crypto from 'node:crypto';
import type { PdfArtifact, PdfImportOperation, Prisma } from '@prisma/client';
import { beginInvestigationRecord } from './record';
import { acceptPdfImport } from '../operations/accept-import';
import { createJobInput } from '../jobs/claim-input';
import { DEFAULT_JOB_POLICY } from '../jobs/policy';
import { PDF_IMPORT_PROFILE, PDF_CONFIG_HASH } from '../admission/profile';
import { enqueuePdfJob } from '../jobs/enqueue';
import { addBookToUserLibraryTx } from '../../membership/add-book-to-user-library';

// The real record/acceptance/owned-operation/job-contract path runs here. The
// database/membership and unrelated report persistence boundaries are mocked;
// the disposable PostgreSQL proof establishes their real guard behavior.
jest.mock('../jobs/enqueue');
jest.mock('../../membership/add-book-to-user-library');
jest.mock('./accepted-import');
jest.mock('node:crypto', () => ({
  ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
  randomUUID: jest.fn(),
}));

afterEach(() => {
  jest.clearAllMocks();
});
it('digit-leading UUIDs produce a job-compatible new identity, reused by retry and actual acceptance', async () => {
  jest
    .mocked(crypto.randomUUID)
    .mockReturnValue('00000000-0000-4000-8000-000000000001');
  let saved: Record<string, unknown> | null = null;
  let accepted: PdfImportOperation | undefined;
  const tx = {
    pdfImportOperation: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        accepted = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'QUEUED',
          stage: 'PREFLIGHT',
          generation: 1,
          cancellationEpoch: 0,
          progressTotal: null,
        } as unknown as PdfImportOperation;
        return Promise.resolve(accepted);
      }),
    },
    pdfConversionInvestigation: {
      findUnique: jest.fn(() => Promise.resolve(saved)),
      upsert: jest.fn(({ create }: { create: Record<string, unknown> }) => {
        saved = create;
        return Promise.resolve(create);
      }),
    },
    book: { create: jest.fn().mockResolvedValue({ id: 'book-one' }) },
    pdfArtifact: { update: jest.fn() },
  };
  const client = tx as unknown as Prisma.TransactionClient;
  const original = await beginInvestigationRecord(
    client,
    'owner-one',
    'request-key-12345678',
  );
  const retry = await beginInvestigationRecord(
    client,
    'owner-one',
    'request-key-12345678',
  );
  expect(retry).toBe(original);
  expect(tx.pdfConversionInvestigation.upsert).toHaveBeenCalledTimes(1);
  jest
    .mocked(addBookToUserLibraryTx)
    .mockResolvedValue({ libraryItemId: 'library-one' } as never);
  jest.mocked(enqueuePdfJob).mockResolvedValue({ id: 'job-one' } as never);
  const source = {
    id: 'source-one',
    blobId: 'blob-one',
    sizeBytes: 9,
  } as PdfArtifact;
  const input = {
    userId: 'owner-one',
    artifact: source,
    filename: 'Synthetic.pdf',
    inspection: {
      source_sha256: 'a'.repeat(64),
      page_count: 2,
      metadata: {},
      pages: [
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ],
    },
    idempotencyKey: 'request-key-12345678',
    sourceSha256: 'a'.repeat(64),
    requestSha256: 'a'.repeat(64),
    configSha256: PDF_CONFIG_HASH,
    configuration: PDF_IMPORT_PROFILE,
  };
  await acceptPdfImport(client, input, retry.id);
  expect(accepted?.id).toBe(retry.id);
  const now = new Date(),
    deadline = new Date(now.getTime() + 60_000);
  expect(() =>
    createJobInput({
      op: accepted!,
      source,
      policy: DEFAULT_JOB_POLICY,
      fingerprint: 'b'.repeat(64),
      fence: 1,
      generation: 1,
      mode: 'live',
      dispatchAuthorizationId: 'grant-one',
      now,
      deadline,
      pages: 2,
    }),
  ).not.toThrow();
});

it('retains a historical identity and operation tombstone verbatim instead of renaming it', async () => {
  const retained = {
    id: '00000000-0000-4000-8000-000000000002',
    operationKey: 'old-operation',
    status: 'FAILED',
  };
  const tx = {
    pdfImportOperation: { findUnique: jest.fn().mockResolvedValue(null) },
    pdfConversionInvestigation: {
      findUnique: jest.fn().mockResolvedValue(retained),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };
  expect(
    await beginInvestigationRecord(
      tx as unknown as Prisma.TransactionClient,
      'owner-one',
      'request-key-12345678',
    ),
  ).toBe(retained);
  expect(tx.pdfConversionInvestigation.create).not.toHaveBeenCalled();
  expect(tx.pdfConversionInvestigation.upsert).not.toHaveBeenCalled();
});
