import type { PdfConversionEvent, Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ClaimedPdfJob, Tx } from '../../library/pdf-import/jobs/types';
import type { JobInputV1 } from '../contracts/generated/ava-pdf-job-1';
import type { WorkerResultV1 } from '../contracts/generated/ava-pdf-worker-result-1';
import { fixtureBytes } from '../contracts/contract-fixtures';
import { executeOne } from './execute-one';
import { claimPdfJob } from '../../library/pdf-import/jobs';
import { runClaimedContent } from './run-claimed-content';
import { workerObservationSink } from './worker-observation-sink';
import { secretDigest } from '../../library/pdf-import/jobs/secrets';
import { DEFAULT_JOB_POLICY } from '../../library/pdf-import/jobs/policy';
import { recordOperationEvent } from '../../library/pdf-import/reports/operation-event';
import { retainedEventInput } from '../../library/pdf-import/reports/event-contract';
import { projectObservationCoverage } from '../../library/pdf-import/reports/observation-coverage';
import { PdfRuntimeError } from './runtime-error';
import { PdfProviderError } from '../../library/pdf-import/providers/errors';
import { testConfig } from './config-fixture';
import { underLease } from './lease-guard';
import type { WorkerObserver } from './worker-observer';

jest.mock('../../library/pdf-import/jobs', () => ({
  ...jest.requireActual<typeof import('../../library/pdf-import/jobs')>(
    '../../library/pdf-import/jobs',
  ),
  claimPdfJob: jest.fn(),
}));
jest.mock('./run-claimed-content', () => ({ runClaimedContent: jest.fn() }));
let mockSink: ReturnType<typeof workerObservationSink> | undefined;
jest.mock('./worker-observation-sink', () => {
  const actual = jest.requireActual<typeof import('./worker-observation-sink')>(
    './worker-observation-sink',
  );
  return {
    ...actual,
    workerObservationSink: (
      ...args: Parameters<typeof actual.workerObservationSink>
    ) => {
      mockSink = actual.workerObservationSink(...args);
      return mockSink;
    },
  };
});

// Controlled database data/transaction adapter, not a SQL or real-account proof.
// Authority, scope checks, settlement, sink, journal/hash and projection are real.
function setup() {
  const input = JSON.parse(
    fixtureBytes('ava-pdf-job-1').toString(),
  ) as JobInputV1;
  const now = new Date(),
    token = 'w'.repeat(32),
    attemptToken = 't'.repeat(32);
  const operation = {
    id: input.operation_id,
    ownerId: input.owner_id,
    libraryItemId: input.library_item_id,
    bookId: 'book',
    sourceArtifactId: input.source.id,
    sourceSha256: input.source.sha256,
    configSha256: input.config_sha256,
    requestSha256: input.request_sha256,
    profileId: input.profile_id,
    generation: input.generation,
    cancellationEpoch: input.cancellation_epoch,
    status: 'RUNNING',
    stage: 'EXTRACTION',
    finalContentId: null,
    deletedAt: null,
  };
  const job = {
    id: 'job',
    state: 'RUNNING',
    currentAttemptId: 'attempt',
    attemptFence: input.attempt_fence,
    workerFingerprint: input.worker_fingerprint,
    providerMode: input.provider_mode,
    operationId: operation.id,
    operation,
    policy: DEFAULT_JOB_POLICY,
    attemptCount: 1,
    deadlineAt: new Date(now.getTime() + 120_000),
  };
  const attempt = {
    id: 'attempt',
    jobId: job.id,
    principalId: 'worker',
    fence: input.attempt_fence,
    attemptTokenHash: secretDigest(attemptToken),
    jobInput: input,
    job,
    status: 'RUNNING',
    resultSha256: null,
    leaseExpiresAt: new Date(now.getTime() + 30_000),
    deadlineAt: job.deadlineAt,
  };
  const record = {
    id: operation.id,
    operationKey: operation.id,
    nextSequence: 0,
    status: 'RUNNING',
    coverage: 'API_LIFECYCLE',
    activeAdmissionCount: 0,
  };
  const journal: PdfConversionEvent[] = [];
  const mutate =
    (target: object) =>
    ({ data }: { data: object }) => {
      Object.assign(target, data);
      return Promise.resolve(target);
    };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ now, locked: true }]),
    libraryItem: {
      findFirst: jest.fn().mockResolvedValue({ id: operation.libraryItemId }),
    },
    pdfWorkerPrincipal: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'worker',
        tokenHash: secretDigest(token),
        revokedAt: null,
        workerFingerprint: input.worker_fingerprint,
        modes: [input.provider_mode],
      }),
    },
    pdfJobAttempt: {
      findUnique: () => Promise.resolve(attempt),
      findUniqueOrThrow: () => Promise.resolve(attempt),
      update: mutate(attempt),
    },
    pdfConversionJob: { update: mutate(job) },
    pdfImportOperation: { update: mutate(operation) },
    pdfJobFailure: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'failure', safeReason: 'Safe failure.' }),
    },
    pdfNotificationIntent: { create: jest.fn().mockResolvedValue({}) },
    pdfArtifact: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    pdfProviderGrant: { findUnique: jest.fn().mockResolvedValue(null) },
    pdfConversionCost: { upsert: jest.fn().mockResolvedValue({}) },
    pdfConversionInvestigation: {
      findUnique: () => Promise.resolve(record),
      findUniqueOrThrow: () => Promise.resolve(record),
      update: ({ data }: { data: Record<string, unknown> }) => {
        const increment = data.nextSequence as
          | { increment: number }
          | undefined;
        if (increment) record.nextSequence += increment.increment;
        for (const [key, value] of Object.entries(data))
          if (key !== 'nextSequence') Object.assign(record, { [key]: value });
        return Promise.resolve(record);
      },
    },
    pdfConversionEvent: {
      findUnique: ({
        where,
      }: {
        where: { conversionId_producerKey: { producerKey: string } };
      }) =>
        Promise.resolve(
          journal.find(
            (row) =>
              row.producerKey === where.conversionId_producerKey.producerKey,
          ) ?? null,
        ),
      create: ({
        data,
      }: {
        data: Prisma.PdfConversionEventUncheckedCreateInput;
      }) => {
        const row = {
          ...data,
          id: 'event-' + journal.length,
          createdAt: now,
        } as PdfConversionEvent;
        journal.push(row);
        return Promise.resolve(row);
      },
    },
  } as unknown as Tx;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prisma = {
    $transaction: async (
      work: (value: Tx) => Promise<unknown>,
      options?: { timeout: number },
    ) => {
      if (options?.timeout === 750) await gate;
      return work(tx);
    },
  } as unknown as PrismaService;
  const credential = { principalId: 'worker', token };
  const claim = {
    jobId: job.id,
    authority: { ...credential, attemptId: attempt.id, attemptToken },
    job: input,
    leaseExpiresAt: attempt.leaseExpiresAt,
    deadlineAt: attempt.deadlineAt,
    artifactByteLimit: 64 * 1024 ** 2,
    serverNow: now,
    leaseRemainingMs: 30_000,
    deadlineRemainingMs: 120_000,
  } as ClaimedPdfJob;
  jest.mocked(claimPdfJob).mockResolvedValue(claim);
  return { tx, prisma, credential, claim, journal, record, release };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockSink = undefined;
});
async function declare(fixture: ReturnType<typeof setup>) {
  await recordOperationEvent(
    fixture.tx,
    fixture.claim.job.operation_id,
    'claim',
    {
      kind: 'CLAIMED',
      stage: 'PREFLIGHT',
      severity: 'INFO',
      attemptId: 'attempt',
      attemptFence: fixture.claim.job.attempt_fence,
      generation: fixture.claim.job.generation,
      cancellationEpoch: fixture.claim.job.cancellation_epoch,
      details: {
        jobId: fixture.claim.jobId,
        sourceSha256: fixture.claim.job.source.sha256,
        configSha256: fixture.claim.job.config_sha256,
        profileId: fixture.claim.job.profile_id,
        workerFingerprint: fixture.claim.job.worker_fingerprint,
        observationProtocol: {
          version: 1,
          producerId: 'attempt',
          scope: 'COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY',
        },
      },
    },
  );
}
it.each([
  { error: new PdfRuntimeError('RESOURCE_LIMIT'), status: 'FAILED' },
  { error: new PdfRuntimeError('WORKER_CRASH'), status: 'QUEUED' },
  {
    error: new PdfProviderError('PDF_PROVIDER_OUTCOME_UNCERTAIN'),
    status: 'WAITING',
  },
])(
  'real $status settlement retains the exact closed boundary while optional writes remain pending',
  async ({ error, status }) => {
    const fixture = setup();
    await declare(fixture);
    jest
      .mocked(runClaimedContent)
      .mockImplementation(async (_p, _c, _s, _v, _g, observer) => {
        if (!observer) throw new Error('Expected real observer');
        return observer.track('EXTRACTION', 'unit-failure', () =>
          Promise.reject(error),
        );
      });
    await expect(
      executeOne(fixture.prisma, fixture.credential, testConfig, () =>
        Promise.resolve(true),
      ),
    ).resolves.toMatchObject({ status });
    expect(mockSink?.summary().pending).toBe(2);
    const before = projectObservationCoverage(
      fixture.journal.map((row) => ({
        sequence: row.sequence,
        event: retainedEventInput(row),
      })),
      fixture.record.nextSequence,
    );
    expect(before).toMatchObject({
      state: 'PARTIAL',
      producers: [
        {
          exactFinalCountKnown: true,
          expectedThroughOrdinal: 2,
          missingOrdinalCount: 2,
        },
      ],
    });
    fixture.release();
    await mockSink?.whenSettled();
    expect(mockSink?.summary()).toMatchObject({ pending: 0, lost: 2 });
    const restarted = projectObservationCoverage(
      fixture.journal.map((row) => ({
        sequence: row.sequence,
        event: retainedEventInput(row),
      })),
      fixture.record.nextSequence,
    );
    expect(restarted).toMatchObject({
      state: 'PARTIAL',
      producers: [{ exactFinalCountKnown: true, expectedThroughOrdinal: 2 }],
    });
  },
);
it('real controlled candidate acceptance retains closure and permits freshly fenced late observation delivery', async () => {
  const fixture = setup();
  await declare(fixture);
  const result = JSON.parse(
    fixtureBytes('ava-pdf-worker-result-1').toString(),
  ) as WorkerResultV1;
  if (result.outcome.status !== 'candidate')
    throw new Error('Expected candidate fixture');
  result.outcome.canonical_schema = 'ava-book-2';
  const descriptors = [
    result.outcome.canonical_book,
    result.outcome.epub,
    result.outcome.validation_report,
    ...result.outcome.resources,
  ];
  const reconstructed = {
    completion: {
      exitCode: result.outcome.cli_exit_code,
      bytes: Buffer.from(JSON.stringify(result)),
    },
    stagedByPath: Object.fromEntries(
      descriptors.map((descriptor) => [
        descriptor.path,
        'staged-' + descriptor.id,
      ]),
    ),
  } as Awaited<ReturnType<typeof runClaimedContent>>;
  jest
    .mocked(runClaimedContent)
    .mockImplementation(async (_p, _c, _s, _v, _g, observer) => {
      if (!observer) throw new Error('Expected real observer');
      return observer.track('ASSEMBLY', 'unit-candidate', () =>
        Promise.resolve(reconstructed),
      );
    });
  await expect(
    executeOne(fixture.prisma, fixture.credential, testConfig, () =>
      Promise.resolve(true),
    ),
  ).resolves.toMatchObject({ status: 'WAITING' });
  expect(mockSink?.summary().pending).toBe(2);
  const view = () =>
    projectObservationCoverage(
      fixture.journal.map((row) => ({
        sequence: row.sequence,
        event: retainedEventInput(row),
      })),
      fixture.record.nextSequence,
    );
  expect(view()).toMatchObject({
    state: 'PARTIAL',
    producers: [{ exactFinalCountKnown: true, expectedThroughOrdinal: 2 }],
  });
  fixture.release();
  await mockSink?.whenSettled();
  expect(view()).toMatchObject({ state: 'RECORDED', complete: true });
  expect(fixture.journal.at(-1)?.details).toHaveProperty('observationDelivery');
});
it('abort returns without sealing tracked background work that ends after executeOne', async () => {
  const fixture = setup();
  await declare(fixture);
  const controller = new AbortController();
  let begin!: () => void,
    finish!: (result: Awaited<ReturnType<typeof runClaimedContent>>) => void;
  const begun = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const work = new Promise<Awaited<ReturnType<typeof runClaimedContent>>>(
    (resolve) => {
      finish = resolve;
    },
  );
  let background:
    | Promise<Awaited<ReturnType<typeof runClaimedContent>>>
    | undefined;
  let observed: WorkerObserver | undefined;
  jest
    .mocked(runClaimedContent)
    .mockImplementation(async (_p, _c, _s, _v, guard, observer) => {
      if (!observer) throw new Error('Expected real observer');
      observed = observer;
      background = observer.track('ASSEMBLY', 'unit-background', () => work);
      begin();
      return underLease(() => background!, guard.signal);
    });
  const executing = executeOne(
    fixture.prisma,
    fixture.credential,
    testConfig,
    () => Promise.resolve(true),
    controller.signal,
  );
  await begun;
  controller.abort();
  await expect(executing).resolves.toMatchObject({ status: 'authority_lost' });
  expect(observed?.snapshot()?.sealed).toBe(false);
  finish({} as Awaited<ReturnType<typeof runClaimedContent>>);
  await background;
  expect(observed?.finishCapture()).toBeUndefined();
  fixture.release();
  await mockSink?.whenSettled();
  expect(
    projectObservationCoverage(
      fixture.journal.map((row) => ({
        sequence: row.sequence,
        event: retainedEventInput(row),
      })),
      fixture.record.nextSequence,
    ),
  ).toMatchObject({
    state: 'UNSEALED',
    complete: false,
    producers: [{ exactFinalCountKnown: false, recordedOrdinalCount: 2 }],
  });
});
