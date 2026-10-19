import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { diagnosticFixture } from './diagnostic-test-fixture';
import { recordEpubEvent, EPUB_EVENT_LIMIT } from './diagnostics';
import { epubPhases } from './phase';
import { recordEpubClaim } from './claim-diagnostics';
import { epubInvestigationId } from './diagnostic-snapshot';
import { EpubLeaseExpired } from './import-output';
import { epubFailureCode } from './failure-code';
const event = {
  kind: 'STAGE_ENDED' as const,
  stage: 'EPUB_ACTIVATION',
  severity: 'WARN' as const,
  code: 'ACTIVATION_UNAVAILABLE',
  attemptFence: 1,
  details: {},
};
it('retains first occurrence verbatim and survives Ready with truthful native identity and no PDF operation', async () => {
  const { db, runs, events, investigations } = diagnosticFixture();
  const client = db as unknown as PrismaService;
  await recordEpubEvent(client, 'run-0', {
    ...event,
    observedAt: '2026-10-11T12:00:00.000Z',
  });
  await recordEpubEvent(client, 'run-0', {
    ...event,
    observedAt: '2026-10-11T12:01:00.000Z',
  });
  expect(events).toHaveLength(1);
  expect(events[0].observedAt).toEqual(new Date('2026-10-11T12:00:00.000Z'));
  runs[0].status = 'READY';
  await recordEpubEvent(client, 'run-0', {
    ...event,
    kind: 'PUBLISHED',
    severity: 'INFO',
    code: undefined,
  });
  expect(investigations.get(epubInvestigationId('run-0'))).toMatchObject({
    jobId: 'run-0',
    ownerId: 'owner',
    libraryItemId: 'item-0',
    sourceSha256: '1'.repeat(64),
    status: 'READY',
    finalContentId: 'content-0',
    operationKey: null,
    operationId: null,
    coverage: 'EPUB_PREPARATION',
    workerFingerprint: '3'.repeat(64),
  });
  const report = investigations.get(epubInvestigationId('run-0'))!;
  expect(report.profileId).toBeNull();
  expect(report.sourcePages).toBeNull();
});
it('bounds durable events and records overflow without changing preparation outcome', async () => {
  const { db, events, investigations } = diagnosticFixture();
  const client = db as unknown as PrismaService;
  await recordEpubEvent(client, 'run-0', event);
  const row = investigations.get(epubInvestigationId('run-0'))!;
  row.nextSequence = EPUB_EVENT_LIMIT;
  expect(
    await recordEpubEvent(client, 'run-0', {
      ...event,
      code: 'OVERFLOW_PROBE',
    }),
  ).toBe(true);
  expect(events).toHaveLength(1);
  expect(row.evidenceGaps).toContain('EPUB_EVENT_OVERFLOW');
});
it('diagnostic failure is explicit, content-free and cannot replace the work result', async () => {
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => {});
  try {
    const { db } = diagnosticFixture();
    db.$transaction.mockRejectedValue(
      new Error(
        'private row sk-test-secret https://private.test/?token=secret',
      ),
    );
    const result = await epubPhases(
      db as unknown as PrismaService,
      'run-0',
      1,
    )('EPUB_ARTIFACT_STORAGE', () => Promise.resolve('same-result'));
    expect(result).toBe('same-result');
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({ code: 'EPUB_DIAGNOSTIC_WRITE_LOST', runId: 'run-0' }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(
      /private row|sk-test|https:/,
    );
    expect(db.bookProcessingRun.updateMany).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
  }
});
it('distinguishes expired lease reclaim from the caught supervisor expiry and queue wait from work', async () => {
  const { db, events, runs } = diagnosticFixture();
  runs[0].attemptFence = 2;
  await recordEpubClaim(db as unknown as PrismaService, {
    runId: 'run-0',
    ownerId: 'owner',
    libraryItemId: 'item-0',
    fence: 2,
    token: 'never-record',
    leaseRemainingMs: 30000,
    recoveredExpiredLease: true,
    queuedAt: new Date('2026-10-11T11:00:00Z'),
    claimedAt: new Date('2026-10-11T12:00:00Z'),
  });
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: 'RECOVERED',
      code: 'EXPIRED_LEASE_RECLAIM',
      attemptFence: 2,
    }),
  );
  expect(epubFailureCode(new EpubLeaseExpired())).toBe('LEASE_EXPIRED');
  expect(JSON.stringify(events)).not.toContain('never-record');
  const queued = diagnosticFixture();
  await recordEpubClaim(queued.db as unknown as PrismaService, {
    runId: 'run-0',
    ownerId: 'owner',
    libraryItemId: 'item-0',
    fence: 1,
    token: 'never-record',
    leaseRemainingMs: 30000,
    recoveredExpiredLease: false,
    queuedAt: new Date('2026-10-11T11:00:00Z'),
    claimedAt: new Date('2026-10-11T12:00:00Z'),
  });
  expect(queued.events).toContainEqual(
    expect.objectContaining({
      stage: 'EPUB_QUEUE',
      kind: 'STAGE_ENDED',
      attemptFence: 1,
      durationMs: 3600000,
      durationKind: 'OBSERVED_WALL_CLOCK',
    }),
  );
});

it('binds a late phase observation to its original fence and explicitly marks staleness', async () => {
  const { db, runs, events, investigations } = diagnosticFixture();
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const phase = epubPhases(
    db as unknown as PrismaService,
    'run-0',
    1,
  )('EPUB_READER_VALIDATION', async () => {
    await waiting;
    return 'old-work-result';
  });
  while (!events.length) await Promise.resolve();
  runs[0].attemptFence = 2;
  release!();
  expect(await phase).toBe('old-work-result');
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: 'STOPPED',
      code: 'STALE_FENCE_OBSERVATION',
      attemptFence: 1,
    }),
  );
  expect(events.some((e) => e.attemptFence === 2)).toBe(false);
  expect(
    investigations.get(epubInvestigationId('run-0'))!.evidenceGaps,
  ).toContain('STALE_FENCE_OBSERVATION');
});

it('retains both stale and overflow gaps when a late observation reaches the event cap', async () => {
  const { db, runs, events, investigations } = diagnosticFixture();
  await recordEpubEvent(db as unknown as PrismaService, 'run-0', event);
  const row = investigations.get(epubInvestigationId('run-0'))!;
  row.nextSequence = EPUB_EVENT_LIMIT;
  runs[0].attemptFence = 2;
  await recordEpubEvent(db as unknown as PrismaService, 'run-0', {
    ...event,
    stage: 'EPUB_READER_VALIDATION',
  });
  expect(row.evidenceGaps).toEqual(
    expect.arrayContaining(['STALE_FENCE_OBSERVATION', 'EPUB_EVENT_OVERFLOW']),
  );
  expect(events).toHaveLength(1);
});
