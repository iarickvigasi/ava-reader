import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { costTransaction } from '../library/pdf-import/providers/cost-lock';
import { settlePdfProvider } from '../library/pdf-import/providers/settle';
import {
  beginConversionAdmission,
  completeConversionAdmission,
  refuseConversionAdmission,
} from '../library/pdf-import/reports/admission';
import { appendConversionEvent } from '../library/pdf-import/reports/append-event';
import { recordAcceptedImport } from '../library/pdf-import/reports/accepted-import';
import {
  adminReportRead,
  readReportCost,
  readReportEvents,
} from '../library/pdf-import/reports/read';
import { reconcileConversionReport } from '../library/pdf-import/reports/reconcile';
import { reportId } from '../library/pdf-import/reports/event-contract';
import { checksumBuffer } from '../shared/blob-utils';
import { createOwnedPdfImport } from '../library/pdf-import/operations/create-owned-import';
import { PDF_IMPORT_PROFILE } from '../library/pdf-import/admission/profile';
import { DEFAULT_JOB_POLICY } from '../library/pdf-import/jobs/policy';
import { createJobInput } from '../library/pdf-import/jobs/claim-input';
import { startAttempt } from '../library/pdf-import/jobs/start-attempt';
import { terminalFailure } from '../library/pdf-import/jobs/terminal-failure';
import { databaseNow } from '../library/pdf-import/jobs/transaction';
import { allocateProviderBudgets } from '../library/pdf-import/providers/allocate';
import type { Tx } from '../library/pdf-import/jobs/types';

// This command writes synthetic fixtures and fault-injection triggers only in
// root's disposable database. It never calls Clerk, an LLM, or a worker.
export function requireReportsProofDatabase(env: NodeJS.ProcessEnv) {
  if (env.AVA_PDF_REPORTS_PROOF !== 'synthetic-only')
    throw new Error('PDF_REPORTS_PROOF_OPT_IN_REQUIRED');
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL ?? '');
  } catch {
    throw new Error('PDF_REPORTS_PROOF_DATABASE_REQUIRED');
  }
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port !== '55417' ||
    url.pathname !== '/ava_pdf_reports_test' ||
    [...url.searchParams].some(
      ([key, value]) => key !== 'schema' || value !== 'public',
    )
  )
    throw new Error('PDF_REPORTS_PROOF_WRONG_DATABASE');
}

const hash = 'a'.repeat(64);
const prefix = 'pdf-report-proof-';
const safeEvent = {
  kind: 'PROGRESS' as const,
  stage: 'EXTRACTION',
  severity: 'INFO' as const,
  details: { completed: 1, total: 2 },
};

export function syntheticSource(now = new Date()) {
  const bytes = Buffer.from('synthetic');
  return {
    bytes,
    sizeBytes: bytes.length,
    checksum: checksumBuffer(bytes),
    retention: 'STAGING' as const,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
  };
}

// Reuse the real owned-import writer, including Library membership and source
// attachment. These seeded bytes never undergo PDF parsing or worker execution.
async function createSyntheticOperation(
  tx: Tx,
  ownerId: string,
  id: string,
  key: string,
) {
  const source = syntheticSource(await databaseNow(tx));
  const blob = await tx.storedBlob.create({
    data: {
      purpose: 'BOOK_SOURCE',
      mimeType: 'application/pdf',
      sizeBytes: source.sizeBytes,
      originalFilename: 'PRIVATE_PATH_CANARY.pdf',
      checksum: source.checksum,
      bytes: source.bytes,
    },
  });
  const artifact = await tx.pdfArtifact.create({
    data: {
      ownerId,
      blobId: blob.id,
      role: 'SOURCE_PDF',
      checksum: source.checksum,
      sizeBytes: source.sizeBytes,
      mimeType: 'application/pdf',
      retention: source.retention,
      expiresAt: source.expiresAt,
    },
  });
  const op = await createOwnedPdfImport(
    tx,
    {
      userId: ownerId,
      artifact,
      filename: 'PRIVATE_PATH_CANARY.pdf',
      inspection: {
        source_sha256: source.checksum,
        page_count: 2,
        metadata: {},
        pages: [
          { width: 100, height: 100 },
          { width: 100, height: 100 },
        ],
      },
      idempotencyKey: key,
      sourceSha256: source.checksum,
      requestSha256: hash,
      configSha256: checksumBuffer(
        Buffer.from(JSON.stringify(PDF_IMPORT_PROFILE)),
      ),
      configuration: PDF_IMPORT_PROFILE,
    },
    id,
  );
  return { op, artifact, source };
}

// GLOBAL/ACCOUNT/MODEL budgets may accumulate several synthetic operations;
// never reset retained ledger totals. New budgets start with no allocations.
async function fixtureBudgets(
  tx: Tx,
  operationId: string,
  accountKey: string,
  modelId: string,
) {
  const scopes = [
    ['GLOBAL', 'ava'],
    ['ACCOUNT', accountKey],
    ['MODEL', modelId],
    ['OPERATION', operationId],
  ] as const;
  const budgets = [];
  for (const [scope, scopeKey] of scopes)
    budgets.push(
      await tx.pdfProviderBudget.upsert({
        where: { scope_scopeKey: { scope, scopeKey } },
        create: {
          scope,
          scopeKey,
          limitNano: 1000000000n,
          hardCeilingNano: 1000000000n,
          baselineEvidenceSha256: hash,
        },
        update: {},
      }),
    );
  return budgets;
}

async function fixtureAuthority(
  tx: Tx,
  fixture: Awaited<ReturnType<typeof createSyntheticOperation>>,
  route: { id: string; accountKey: string; modelId: string },
  principalId: string,
) {
  const { op, artifact } = fixture;
  const budgets = await fixtureBudgets(
    tx,
    op.id,
    route.accountKey,
    route.modelId,
  );
  const grant = await tx.pdfProviderGrant.create({
    data: {
      operationId: op.id,
      operationKey: op.id,
      ownerId: op.ownerId,
      sourceSha256: op.sourceSha256,
      configSha256: op.configSha256,
      routeId: route.id,
      budgetIds: budgets.map((budget) => budget.id),
    },
  });
  const job = await tx.pdfConversionJob.create({
    data: {
      operationId: op.id,
      policy: DEFAULT_JOB_POLICY,
      policySha256: checksumBuffer(
        Buffer.from(JSON.stringify(DEFAULT_JOB_POLICY)),
      ),
      providerMode: 'live',
      dispatchAuthorizationId: grant.id,
    },
  });
  await recordAcceptedImport(tx, op, job, {
    bytes: fixture.source.sizeBytes,
    pages: 2,
  });
  const now = await databaseNow(tx),
    deadline = new Date(now.getTime() + 30 * 60 * 1000);
  const input = createJobInput({
    op,
    source: artifact,
    policy: DEFAULT_JOB_POLICY,
    fingerprint: hash,
    fence: 1,
    generation: op.generation,
    mode: 'live',
    dispatchAuthorizationId: grant.id,
    now,
    deadline,
    pages: 2,
  });
  const { attempt } = await startAttempt(
    tx,
    job,
    input,
    principalId,
    now,
    deadline,
    DEFAULT_JOB_POLICY.leaseMs,
  );
  return { budgets, grant, attempt };
}

async function failSyntheticOperation(tx: Tx, id: string, attemptId: string) {
  const op = await tx.pdfImportOperation.findUniqueOrThrow({ where: { id } });
  const job = await tx.pdfConversionJob.findUniqueOrThrow({
    where: { operationId: id },
  });
  await terminalFailure(tx, {
    operation: op,
    job,
    attemptId,
    code: 'CONVERSION_FAILED',
    now: await databaseNow(tx),
  });
}

async function verifyRetained(prisma: PrismaService, id: string) {
  const header = await prisma.pdfConversionInvestigation.findUniqueOrThrow({
    where: { id },
  });
  assert(header.ownerId?.startsWith(prefix), 'PDF_REPORTS_PROOF_NOT_SYNTHETIC');
  assert.equal(header.operationId, null);
  const report = await prisma.$transaction((tx) => readReportCost(tx, id), {
    isolationLevel: 'RepeatableRead',
  });
  assert.equal(report.state, 'FINAL');
  assert.equal('knownActualNano' in report && report.knownActualNano, '30');
  assert.equal('callCount' in report && report.callCount, 2);
  assert.equal(
    await prisma.pdfConversionEvent.count({ where: { conversionId: id } }),
    0,
  );
  return {
    conversionId: id,
    costNano: '30',
    callCount: 2,
    operationPurged: true,
    eventHistoryPurged: true,
  };
}

async function runProof(prisma: PrismaService) {
  const step = (name: string) =>
    process.stdout.write(
      JSON.stringify({ syntheticOnly: true, step: name }) + '\n',
    );
  const runId = prefix + randomUUID();
  const owner = await prisma.user.create({
    data: {
      id: runId + '-owner',
      clerkUserId: runId + '-clerk',
      primaryEmail: 'synthetic@example.invalid',
    },
  });
  const admin = await prisma.user.create({
    data: {
      id: runId + '-admin',
      clerkUserId: runId + '-admin-clerk',
      primaryEmail: 'synthetic-admin@example.invalid',
      roleMemberships: { create: { role: 'ADMIN' } },
    },
  });
  const results: string[] = [];
  step('same-key-admission');

  // Two simultaneous pre-job requests share identity without a phantom Book;
  // one refusal cannot finalize the other request's active empty ledger.
  const key = runId + '-refused';
  const [first, second] = await Promise.all([
    beginConversionAdmission(prisma, owner.id, key),
    beginConversionAdmission(prisma, owner.id, key),
  ]);
  assert.equal(first.conversionId, second.conversionId);
  assert.equal(
    await prisma.pdfImportOperation.count({ where: { ownerId: owner.id } }),
    0,
  );
  await refuseConversionAdmission(
    prisma,
    first,
    new UnprocessableEntityException({ code: 'PDF_INTAKE_BUSY' }),
  );
  assert.equal(
    (
      await prisma.pdfConversionCost.findUniqueOrThrow({
        where: { conversionId: first.conversionId },
      })
    ).state,
    'PROVISIONAL',
  );
  await refuseConversionAdmission(
    prisma,
    first,
    new UnprocessableEntityException({ code: 'PDF_INTAKE_BUSY' }),
  );
  await refuseConversionAdmission(
    prisma,
    second,
    new UnprocessableEntityException({ code: 'PDF_INTAKE_BUSY' }),
  );
  assert.equal(
    (
      await prisma.pdfConversionCost.findUniqueOrThrow({
        where: { conversionId: first.conversionId },
      })
    ).state,
    'FINAL',
  );
  const retry = await beginConversionAdmission(prisma, owner.id, key);
  assert.equal(retry.conversionId, first.conversionId);
  assert.equal(
    (
      await prisma.pdfConversionCost.findUniqueOrThrow({
        where: { conversionId: retry.conversionId },
      })
    ).state,
    'PROVISIONAL',
  );
  await refuseConversionAdmission(
    prisma,
    retry,
    new UnprocessableEntityException({ code: 'PDF_INTAKE_BUSY' }),
  );
  results.push('same-key-admission-refusal-retry');

  step('accepted-synthetic-owned-operation');
  const admission = await beginConversionAdmission(
    prisma,
    owner.id,
    runId + '-accepted',
  );
  const fixture = await costTransaction(prisma, (tx) =>
    createSyntheticOperation(
      tx,
      owner.id,
      admission.conversionId,
      runId + '-accepted',
    ),
  );
  const id = admission.conversionId;
  step('journal-concurrency-cursors');

  const delivered = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      prisma.$transaction(
        (tx) =>
          appendConversionEvent(tx, id, runId + '-event-' + index, safeEvent),
        { timeout: 30_000 },
      ),
    ),
  );
  assert.equal(new Set(delivered.map((event) => event.sequence)).size, 12);
  const duplicates = await Promise.all(
    Array.from({ length: 6 }, () =>
      prisma.$transaction(
        (tx) => appendConversionEvent(tx, id, runId + '-same-event', safeEvent),
        { timeout: 30_000 },
      ),
    ),
  );
  assert.equal(new Set(duplicates.map((event) => event.id)).size, 1);
  await assert.rejects(
    prisma.$transaction((tx) =>
      appendConversionEvent(tx, id, runId + '-same-event', {
        ...safeEvent,
        code: 'CONFLICT',
      }),
    ),
    /PDF_REPORT_EVENT_CONFLICT/,
  );
  const events = await prisma.pdfConversionEvent.findMany({
    where: { conversionId: id },
    orderBy: { sequence: 'asc' },
  });
  assert.deepEqual(
    events.map((event) => event.sequence),
    events.map((_, index) => index + 1),
  );
  const page = await prisma.$transaction((tx) =>
    readReportEvents(tx, id, undefined, '2'),
  );
  assert(page.nextCursor);
  await prisma.$transaction((tx) =>
    appendConversionEvent(tx, id, runId + '-after-watermark', safeEvent),
  );
  const next = await prisma.$transaction((tx) =>
    readReportEvents(tx, id, page.nextCursor!, '100'),
  );
  assert.equal(next.watermark, page.watermark);
  assert(next.events.every((event) => event.sequence <= page.watermark));
  await assert.rejects(
    prisma.$transaction((tx) =>
      readReportEvents(tx, first.conversionId, page.nextCursor!),
    ),
    /Invalid/,
  );
  results.push('ordered-deduplicated-conflicting-events-and-fixed-cursors');

  step('synthetic-authority-and-ledger');
  const route = await prisma.pdfProviderRoute.create({
    data: {
      accountKey: runId,
      modelId: 'synthetic/model-' + runId,
      providerSlug: 'synthetic',
      mode: 'live',
      configuration: {
        version: 1,
        maxContextTokens: 100,
        maxOutputTokens: 10,
        maxRequestBytes: 1000,
        maxResponseBytes: 1000,
        maxImages: 0,
        timeoutMs: 1000,
        dataCollection: 'deny',
        zeroDataRetention: true,
        promptHashes: { proof: hash },
        schemaHashes: { proof: hash },
        operationLimitNano: '100000',
        authorizedSourceSha256: [fixture.op.sourceSha256],
      },
      configurationSha256: hash,
      tariff: {
        version: 1,
        promptPerMillionUsd: '1',
        completionPerMillionUsd: '1',
        requestUsd: '0',
        imageUsd: '0',
        evidenceSha256: hash,
        sourceUrl: 'https://example.invalid/synthetic',
      },
      tariffSha256: hash,
      verifiedAt: new Date(),
      validUntil: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const principal = await prisma.pdfWorkerPrincipal.create({
    data: {
      name: runId,
      tokenHash: hash,
      workerFingerprint: hash,
      modes: ['live'],
    },
  });
  const { budgets, calls } = await costTransaction(prisma, async (tx) => {
    const authority = await fixtureAuthority(tx, fixture, route, principal.id);
    const calls = [];
    for (const index of [0, 1]) {
      const call = await tx.pdfProviderCall.create({
        data: {
          grantId: authority.grant.id,
          taskId: runId + '-task-' + index,
          requestSha256: hash,
          taskSha256: hash,
          promptVersion: 'synthetic',
          schemaVersion: 'synthetic',
          reservedAttemptId: authority.attempt.id,
          reservedNano: 1000n,
          accountKey: route.accountKey,
        },
      });
      await allocateProviderBudgets(
        tx,
        authority.grant.budgetIds,
        call.id,
        1000n,
      );
      calls.push(
        await tx.pdfProviderCall.update({
          where: { id: call.id },
          data: {
            state: 'DISPATCHING',
            dispatchAttemptId: authority.attempt.id,
            dispatchedAt: await databaseNow(tx),
          },
        }),
      );
    }
    await failSyntheticOperation(tx, id, authority.attempt.id);
    return { budgets: authority.budgets, calls };
  });
  await completeConversionAdmission(prisma, admission);
  await reconcileConversionReport(prisma, id);
  step('settlement-savepoint-faults');

  // A real PostgreSQL error aborts only the mirror savepoint. The authoritative
  // settled call, all four allocations, and receipt event still commit.
  for (const [index, table] of [
    'PdfConversionEvent',
    'PdfConversionCost',
  ].entries()) {
    let installed = false;
    try {
      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION ava_pdf_reports_proof_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM "PdfConversionInvestigation" WHERE "id" = NEW."conversionId" AND "ownerId" LIKE 'pdf-report-proof-%') THEN RAISE EXCEPTION 'SYNTHETIC_REPORT_SINK_FAILURE'; END IF; RETURN NEW; END $$`,
      );
      installed = true;
      // Only the two fixed table literals above are accepted; no external SQL.
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER ava_pdf_reports_proof_fault BEFORE INSERT OR UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION ava_pdf_reports_proof_fault()`,
      );
      const receipt = Buffer.from(
        JSON.stringify({
          id: runId + '-generation-' + index,
          model: route.modelId,
          usage: {
            cost: index ? '0.000000020' : '0.000000010',
            prompt_tokens: 1,
            completion_tokens: 1,
          },
          choices: [
            {
              finish_reason: 'stop',
              message: { content: 'PRIVATE_RECEIPT_CANARY' },
            },
          ],
        }),
      );
      await settlePdfProvider(prisma, calls[index].id, receipt);
      const settled = await prisma.pdfProviderCall.findUniqueOrThrow({
        where: { id: calls[index].id },
      });
      assert.equal(settled.state, 'SETTLED');
      assert.equal(settled.actualNano, index ? 20n : 10n);
      const allocations = await prisma.pdfProviderAllocation.findMany({
        where: { callId: settled.id },
      });
      assert.equal(allocations.length, 4);
      assert(
        allocations.every(
          (allocation) =>
            allocation.reservedNano === 0n &&
            allocation.actualNano === settled.actualNano,
        ),
      );
      assert.equal(
        await prisma.pdfProviderEvent.count({
          where: { callId: settled.id, kind: 'SETTLED' },
        }),
        1,
      );
      const stale = await prisma.$transaction((tx) => readReportCost(tx, id));
      assert.equal(stale.state, 'STALE');
      await settlePdfProvider(prisma, calls[index].id, receipt);
      assert.equal(
        await prisma.pdfProviderEvent.count({
          where: { callId: settled.id, kind: 'SETTLED' },
        }),
        1,
      );
    } finally {
      if (installed) {
        await prisma.$executeRawUnsafe(
          `DROP TRIGGER IF EXISTS ava_pdf_reports_proof_fault ON "${table}"`,
        );
        await prisma.$executeRawUnsafe(
          'DROP FUNCTION ava_pdf_reports_proof_fault()',
        );
      }
    }
    await reconcileConversionReport(prisma, id);
  }
  const report = await adminReportRead(prisma, admin.id, (tx) =>
    readReportCost(tx, id),
  );
  assert.equal(report.state, 'FINAL');
  assert.equal('knownActualNano' in report && report.knownActualNano, '30');
  const privateCanaries = [
    'PRIVATE_BOOK_TEXT_CANARY',
    'PRIVATE_PATH_CANARY',
    'PRIVATE_RECEIPT_CANARY',
  ];
  const serialized = JSON.stringify(report);
  assert(privateCanaries.every((canary) => !serialized.includes(canary)));
  results.push('real-event-and-projection-savepoints-preserve-known-receipts');
  const chargedBudgets = await prisma.pdfProviderBudget.findMany({
    where: { id: { in: budgets.map((budget) => budget.id) } },
  });
  assert.equal(chargedBudgets.length, 4);
  assert(
    chargedBudgets.every((budget) => {
      const before = budgets.find((row) => row.id === budget.id)!;
      return (
        budget.actualNano === before.actualNano + 30n &&
        budget.reservedNano === before.reservedNano
      );
    }),
  );

  // Actual multi-batch SQL covers the old 1000-call limit. These rows are
  // explicitly seeded synthetic ledger facts, not network receipt evidence.
  step('large-ledger-aggregate-and-detail-pages');
  const largeAdmission = await beginConversionAdmission(
    prisma,
    owner.id,
    runId + '-large',
  );
  const largeId = largeAdmission.conversionId;
  await costTransaction(prisma, async (tx) => {
    const largeFixture = await createSyntheticOperation(
      tx,
      owner.id,
      largeId,
      runId + '-large',
    );
    const largeAuthority = await fixtureAuthority(
      tx,
      largeFixture,
      route,
      principal.id,
    );
    const largeCalls = Array.from({ length: 1001 }, (_, index) => ({
      id: runId + '-large-call-' + String(index).padStart(4, '0'),
      grantId: largeAuthority.grant.id,
      taskId: 'synthetic-task-' + index,
      requestSha256: hash,
      taskSha256: hash,
      promptVersion: 'synthetic',
      schemaVersion: 'synthetic',
      reservedAttemptId: largeAuthority.attempt.id,
      state: 'SETTLED',
      reservedNano: 2n,
      actualNano: 1n,
      receiptSha256: hash,
      providerGenerationId: runId + '-large-generation-' + index,
      accountKey: runId,
    }));
    await tx.pdfProviderCall.createMany({ data: largeCalls });
    for (const budget of largeAuthority.budgets)
      await tx.pdfProviderBudget.update({
        where: { id: budget.id },
        data: { actualNano: { increment: 1001n } },
      });
    await tx.pdfProviderAllocation.createMany({
      data: largeCalls.flatMap((call) =>
        largeAuthority.budgets.map((budget) => ({
          callId: call.id,
          budgetId: budget.id,
          reservedNano: 0n,
          actualNano: 1n,
        })),
      ),
    });
    await failSyntheticOperation(tx, largeId, largeAuthority.attempt.id);
  });
  await completeConversionAdmission(prisma, largeAdmission);
  await reconcileConversionReport(prisma, largeId);
  const largeStored = await prisma.pdfConversionCost.findUniqueOrThrow({
    where: { conversionId: largeId },
  });
  assert.equal(largeStored.knownActualNano, 1001n);
  assert.equal(largeStored.callCount, 1001);
  assert.deepEqual((largeStored.projection as { calls: unknown }).calls, []);
  let costNext: string | undefined;
  let pageCount = 0,
    detailCount = 0,
    detailTotal = 0n;
  const detailIds = new Set<string | null>();
  do {
    const costPage = await prisma.$transaction(
      (tx) => readReportCost(tx, largeId, costNext, '100'),
      { isolationLevel: 'RepeatableRead' },
    );
    assert.equal(costPage.state, 'FINAL');
    const callDetails = 'calls' in costPage ? (costPage.calls ?? []) : [];
    assert(callDetails.length <= 100);
    assert.equal(
      'knownActualNano' in costPage && costPage.knownActualNano,
      '1001',
    );
    for (const call of callDetails) {
      detailCount++;
      detailTotal += BigInt(call.actualNano!);
      assert(!detailIds.has(call.id));
      detailIds.add(call.id);
    }
    const nextCursor = 'nextCursor' in costPage ? costPage.nextCursor : null;
    if (pageCount === 0 && nextCursor)
      await assert.rejects(
        prisma.$transaction((tx) => readReportCost(tx, id, nextCursor)),
        /Invalid cost cursor/,
      );
    costNext = nextCursor ?? undefined;
    pageCount++;
  } while (costNext);
  assert.equal(pageCount, 11);
  assert.equal(detailCount, 1001);
  assert.equal(detailTotal, 1001n);
  results.push('1001-call-exact-aggregate-bounded-complete-detail-pages');
  step('fresh-admin-revocation');

  await assert.rejects(
    adminReportRead(prisma, owner.id, (tx) => readReportCost(tx, id)),
    /AVA reviewer access required/,
  );
  try {
    await assert.rejects(
      adminReportRead(prisma, admin.id, async (tx) => {
        const value = await readReportCost(tx, id);
        await prisma.userRoleMembership.deleteMany({
          where: { userId: admin.id, role: 'ADMIN' },
        });
        return value;
      }),
      /AVA reviewer access required/,
    );
  } finally {
    await prisma.userRoleMembership.upsert({
      where: { userId_role: { userId: admin.id, role: 'ADMIN' } },
      create: { userId: admin.id, role: 'ADMIN' },
      update: {},
    });
  }
  results.push('fresh-admin-revocation-after-snapshot-read');
  step('purge-retained-cost-replay');

  await prisma.libraryItem.delete({ where: { id: fixture.op.libraryItemId } });
  const tombstone = await prisma.pdfImportOperation.findUniqueOrThrow({
    where: { id },
  });
  assert(tombstone.deletedAt);
  await prisma.pdfConversionEvent.deleteMany({ where: { conversionId: id } });
  await prisma.pdfImportOperation.delete({ where: { id } });
  assert.equal(
    (
      await prisma.pdfConversionInvestigation.findUniqueOrThrow({
        where: { id },
      })
    ).operationId,
    null,
  );
  await assert.rejects(
    beginConversionAdmission(prisma, owner.id, runId + '-accepted'),
    (error: unknown) =>
      error instanceof Error &&
      'getResponse' in error &&
      JSON.stringify(
        (error as { getResponse: () => unknown }).getResponse(),
      ).includes('PDF_IMPORT_REMOVED'),
  );
  assert.equal(
    (
      await prisma.pdfConversionCost.findUniqueOrThrow({
        where: { conversionId: id },
      })
    ).knownActualNano,
    30n,
  );
  assert.equal(await prisma.pdfImportOperation.count({ where: { id } }), 0);
  // Remove only this newly recorded replay event to establish a restart-proof
  // cost lookup with zero timeline rows, independent of content/history purge.
  await prisma.pdfConversionEvent.deleteMany({ where: { conversionId: id } });
  const retained = await verifyRetained(prisma, id);
  results.push('cost-survives-operation-and-event-purge-without-reopening');
  return {
    syntheticOnly: true,
    runId,
    results,
    retained,
    restartCommand: `pdf:reports:proof verify-restart ${id}`,
    limits: [
      'No Clerk HTTP, LLM dispatch, worker, browser or production migration claim.',
      'Connection-loss/transaction-expiry recovery is not fault-injected by this proof.',
      'Fixtures are deliberately retained only in the disposable database.',
    ],
  };
}

export async function main() {
  requireReportsProofDatabase(process.env);
  const args = process.argv.slice(2);
  if (
    (args[0] !== 'run' &&
      !(args[0] === 'verify-restart' && reportId.safeParse(args[1]).success)) ||
    args.length !== (args[0] === 'run' ? 1 : 2)
  )
    throw new Error('PDF_REPORTS_PROOF_COMMAND_INVALID');
  const prisma = new PrismaService();
  try {
    const [database] = await prisma.$queryRaw<
      { name: string; schema: string }[]
    >(
      Prisma.sql`SELECT current_database() AS name, current_schema() AS schema`,
    );
    assert.equal(
      database.name,
      'ava_pdf_reports_test',
      'PDF_REPORTS_PROOF_WRONG_DATABASE',
    );
    assert.equal(database.schema, 'public', 'PDF_REPORTS_PROOF_WRONG_SCHEMA');
    assert.equal(
      await prisma.user.count({
        where: { NOT: { id: { startsWith: prefix } } },
      }),
      0,
      'PDF_REPORTS_PROOF_NON_SYNTHETIC_DATA',
    );
    const result =
      args[0] === 'run'
        ? await runProof(prisma)
        : {
            syntheticOnly: true,
            restartVerification: await verifyRetained(prisma, args[1]),
          };
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally {
    await prisma.$disconnect();
  }
}
if (require.main === module)
  void main().catch((error: unknown) => {
    const cause =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : error instanceof Error
          ? error.message
          : '';
    process.stderr.write(
      JSON.stringify({
        code: 'PDF_REPORTS_PROOF_FAILED',
        causeCode: /^[A-Z][A-Z0-9_]{0,79}$/.test(cause) ? cause : 'UNAVAILABLE',
      }) + '\n',
    );
    process.exitCode = 1;
  });
