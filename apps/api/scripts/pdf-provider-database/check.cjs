'use strict';
const { fork } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const s = require('./shared.cjs');
const {
  assert,
  client,
  jobs,
  providers,
  fixture,
  budget,
  route,
  imported,
  worker,
  task,
  load,
} = s;
const db = client(),
  checks = [],
  children = new Set(),
  principals = [];
let adminId, passed;
const verify = (name, value, details) => {
  assert.ok(value, details ? name + ': ' + JSON.stringify(details) : name);
  checks.push(name);
};
function actor() {
  const child = fork(path.join(__dirname, 'child.cjs'), [], {
    env: { ...process.env, AVA_PDF_DATABASE_TEST_URL: s.url },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  children.add(child);
  let result,
    sent = false;
  const ready = new Promise((resolve, reject) => {
    child.on('message', (message) => {
      if (message.ready) resolve(message.pid);
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (!sent) reject(new Error('CHILD_EXIT_BEFORE_START_' + code));
    });
  });
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('CHILD_DEADLINE'));
    }, 20000);
    child.on('message', (message) => {
      if (message.failure) result = { failure: message.failure };
      if (message.result) result = message.result;
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      children.delete(child);
      resolve({ code, signal, result, pid: child.pid });
    });
  });
  // A child can fail before its ready notification; keep both promises observed.
  ready.catch(() => {});
  done.catch(() => {});
  return {
    ready,
    done,
    send: (message) => {
      sent = true;
      child.send(message);
    },
  };
}
async function runChild(message) {
  const a = actor();
  await a.ready;
  a.send(message);
  return a.done;
}
async function ownWorker(label) {
  const p = await worker(db, label);
  principals.push(p.principalId);
  return p;
}
async function ledgerSums() {
  const rows = await db.$queryRawUnsafe(
    'SELECT b.id FROM "PdfProviderBudget" b LEFT JOIN "PdfProviderAllocation" a ON a."budgetId"=b.id GROUP BY b.id HAVING b."reservedNano"<>COALESCE(sum(a."reservedNano"),0) OR b."actualNano"<>b."baselineNano"+COALESCE(sum(a."actualNano"),0)',
  );
  verify('all four-scope allocation totals agree', rows.length === 0);
}
async function main() {
  const identity = (
    await db.$queryRawUnsafe('SELECT current_database() AS name')
  )[0];
  assert.equal(identity.name, 'ava_pdf_provider_ci');
  for (const m of s.req('@prisma/client').Prisma.dmmf.datamodel.models) {
    assert.equal(
      await db[m.name[0].toLowerCase() + m.name.slice(1)].count(),
      0,
      'fresh database: ' + m.name,
    );
  }
  await budget(db, 'GLOBAL', 'ava');
  await budget(db, 'MODEL', fixture.route.modelId);
  await budget(db, 'ACCOUNT', 'crash');
  const crashRoute = await route(db, 'crash'),
    a = await imported(db, 'crash', crashRoute.id, 10000);
  const old = await jobs.claimPdfJob(db, await ownWorker('old'));
  assert.equal(old.job.operation_id, a.op.operationId);
  const request = task('crash-after-intent'),
    first = await runChild({
      action: 'crash',
      input: { authority: old.authority, task: request },
    });
  verify(
    'real child exits at transport boundary after committed intent',
    first.code === 42 && !first.result,
  );
  const call = await db.pdfProviderCall.findFirstOrThrow({
    where: { grant: { operationId: a.op.operationId } },
  });
  verify(
    'crashed process leaves one dispatch intent and no receipt',
    call.state === 'DISPATCHING' &&
      call.receiptSha256 === null &&
      (await db.pdfProviderEvent.count({
        where: { callId: call.id, kind: 'DISPATCH_INTENT' },
      })) === 1,
  );
  await delay(10100);
  const recovered = await jobs.claimPdfJob(db, await ownWorker('recovered'));
  verify(
    'stock lease recovery retains operation with a new fence',
    recovered.job.operation_id === a.op.operationId &&
      recovered.job.attempt_fence === old.job.attempt_fence + 1,
  );
  const retry = await runChild({
    action: 'retry',
    input: { authority: recovered.authority, task: request },
  });
  verify(
    'fresh process does not resend abandoned dispatch',
    retry.code === 0 &&
      retry.pid !== first.pid &&
      retry.result.code === 'PDF_PROVIDER_OUTCOME_UNCERTAIN' &&
      retry.result.sends === 0,
  );
  const held = await db.pdfProviderCall.findUniqueOrThrow({
    where: { id: call.id },
    include: { allocations: true },
  });
  verify(
    'unknown outcome retains every full hold and pauses route',
    held.state === 'UNCERTAIN' &&
      call.reservedNano > 0n &&
      held.reservedNano === call.reservedNano &&
      held.allocations.length === 4 &&
      held.allocations.every((x) => x.reservedNano === held.reservedNano) &&
      (
        await db.pdfProviderRoute.findUniqueOrThrow({
          where: { id: crashRoute.id },
        })
      ).state === 'PAUSED_UNCERTAIN',
  );
  await jobs.failPdfJob(db, recovered.authority, 'INVALID_RESULT');
  const failed = await db.pdfImportOperation.findUniqueOrThrow({
    where: { id: a.op.operationId },
  });
  verify(
    'terminal Failed has stable failure/investigation and one notification',
    failed.status === 'FAILED' &&
      failed.failureId &&
      failed.investigationMarkedAt &&
      (await db.pdfNotificationIntent.count({
        where: { operationId: failed.id, kind: 'pdf_import_failed' },
      })) === 1,
  );
  const responseCanary = 'PRIVATE_PROVIDER_RESPONSE_SENTINEL';
  const receipt = fixture.response('0.002', {
    id: 'synthetic-crash-late',
    choices: [
      {
        finish_reason: 'stop',
        message: { content: JSON.stringify({ text: responseCanary }) },
      },
    ],
  });
  await providers.settlePdfProvider(db, call.id, receipt);
  await providers.settlePdfProvider(db, call.id, receipt);
  await load('library/pdf-import/providers/payload').storeProviderPayload(
    db,
    a.owner.id,
    call.id,
    'RESPONSE',
    receipt,
  );
  const known = await db.pdfProviderCall.findUniqueOrThrow({
    where: { id: call.id },
    include: { allocations: true },
  });
  verify(
    'known settlement releases all four holds and charges each once',
    known.state === 'SETTLED' &&
      known.allocations.length === 4 &&
      known.allocations.every(
        (row) => row.reservedNano === 0n && row.actualNano === 2000000n,
      ),
  );
  verify(
    'late receipt settles terminal Failed once without revival',
    (
      await db.pdfImportOperation.findUniqueOrThrow({
        where: { id: failed.id },
      })
    ).status === 'FAILED' &&
      (await db.pdfProviderEvent.count({
        where: { callId: call.id, kind: 'SETTLED' },
      })) === 1 &&
      (await db.pdfProviderCall.findUniqueOrThrow({ where: { id: call.id } }))
        .actualNano === 2000000n,
  );
  verify(
    'Failed work cannot be reclaimed',
    (await jobs.claimPdfJob(db, await ownWorker('after-failed'))) === null,
  );
  await ledgerSums();
  const admin = await db.user.create({
    data: {
      clerkUserId: 'provider-ci-admin',
      primaryEmail: 'admin@provider-ci.invalid',
      roleMemberships: { create: { role: 'ADMIN' } },
    },
  });
  adminId = admin.id;
  const read = await runChild({
    action: 'report',
    operationId: failed.id,
    actorClerkId: admin.clerkUserId,
  });
  verify(
    'fresh-process admin export shows final separate known charge',
    read.code === 0 &&
      read.result.state === 'READ' &&
      read.result.value.cost.knownActualNano === '2000000' &&
      read.result.value.cost.actualComplete === true &&
      read.result.value.cost.state === 'FINAL',
    {
      childExitCode: read.code,
      childState: read.result?.state,
      childFailure: read.result?.failure,
      refusalStatus: read.result?.status,
      cost: read.result?.value?.cost && {
        state: read.result.value.cost.state,
        knownActualNano: read.result.value.cost.knownActualNano,
        actualComplete: read.result.value.cost.actualComplete,
        ledgerCoverage: read.result.value.cost.ledgerCoverage,
      },
    },
  );
  function checkPrivacy(value) {
    if (typeof value === 'string') {
      for (const canary of [
        'Transcribe exactly.',
        'Page evidence',
        responseCanary,
      ])
        assert.ok(!value.includes(canary), 'stored private canary leaked');
    } else if (Array.isArray(value)) value.forEach(checkPrivacy);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        assert.ok(
          ![
            'messages',
            'rawRequest',
            'rawResponse',
            'requestBody',
            'responseBody',
            'bytes',
            'blob',
            'payload',
          ].includes(key),
          'private payload key leaked',
        );
        checkPrivacy(item);
      }
    }
  }
  checkPrivacy(read.result.value);
  verify(
    'export excludes stored request/response canaries and raw payload keys',
    true,
  );
  const denied = await runChild({
    action: 'report',
    operationId: failed.id,
    actorClerkId: a.owner.clerkUserId,
  });
  verify(
    'ordinary owner cannot read admin cost export',
    denied.code === 0 &&
      denied.result.state === 'REFUSED' &&
      denied.result.status === 403,
  );
  const replayRead = await runChild({
    action: 'report',
    operationId: failed.id,
    actorClerkId: admin.clerkUserId,
  });
  verify(
    'cost export survives another process restart exactly',
    JSON.stringify(read.result.value) ===
      JSON.stringify(replayRead.result.value),
  );
  const prepared = load(
    'library/pdf-import/providers/prepare-request',
  ).prepareProviderRequest(crashRoute, task('edge'));
  await budget(db, 'ACCOUNT', 'edge', prepared.maximumNano.toString());
  const edgeRoute = await route(db, 'edge'),
    left = await imported(db, 'edge-left', edgeRoute.id),
    right = await imported(db, 'edge-right', edgeRoute.id);
  const claims = [
    await jobs.claimPdfJob(db, await ownWorker('left')),
    await jobs.claimPdfJob(db, await ownWorker('right')),
  ];
  assert.deepEqual(
    new Set(claims.map((c) => c.job.operation_id)),
    new Set([left.op.operationId, right.op.operationId]),
  );
  const racers = [actor(), actor()];
  const pids = await Promise.all(racers.map((x) => x.ready));
  racers.forEach((x, i) =>
    x.send({
      action: 'reserve',
      input: { authority: claims[i].authority, task: task('edge') },
    }),
  );
  const outcomes = await Promise.all(racers.map((x) => x.done)),
    values = outcomes.map((x) => x.result);
  verify(
    'two independent processes compete for one remaining reservation',
    pids[0] !== pids[1] &&
      outcomes.every((x) => x.code === 0) &&
      values.filter((x) => x.state === 'RESERVED').length === 1 &&
      values.filter((x) => x.code === 'PDF_PROVIDER_BUDGET_EXHAUSTED')
        .length === 1,
  );
  const edgeBudget = await db.pdfProviderBudget.findUniqueOrThrow({
    where: { scope_scopeKey: { scope: 'ACCOUNT', scopeKey: 'edge' } },
  });
  verify(
    'account reservation reaches but never exceeds its cap',
    edgeBudget.reservedNano === prepared.maximumNano &&
      edgeBudget.actualNano === 0n &&
      (await db.pdfProviderEvent.count({
        where: { kind: 'DISPATCH_INTENT' },
      })) === 1,
  );
  const winning = values.find((x) => x.state === 'RESERVED');
  await load('library/pdf-import/providers/release').releaseUndispatchedPdfCall(
    db,
    winning.callId,
  );
  for (const op of [left.op, right.op])
    await jobs.stopPdfJob(db, op.operationId);
  await ledgerSums();
  const deniedIndex = values.findIndex(
    (x) => x.code === 'PDF_PROVIDER_BUDGET_EXHAUSTED',
  );
  const zero = await runChild({
    action: 'report',
    operationId: claims[deniedIndex].job.operation_id,
    actorClerkId: admin.clerkUserId,
  });
  verify(
    "denied operation exports final zero cost without another operation's charge",
    zero.result.value.cost.knownActualNano === '0' &&
      zero.result.value.cost.callCount === 0 &&
      zero.result.value.cost.state === 'FINAL',
  );
  await load('library/items/delete-library-item').deleteLibraryItem(
    db,
    a.owner.id,
    a.op.libraryItemId,
  );
  const purge = load(
    'library/pdf-import/retention/purge-operation',
  ).purgeDeletedPdfOperation;
  await assert.rejects(async () => purge(db, failed.id, 1), {
    message: 'PDF_RETENTION_NOT_ENABLED',
  });
  verify('private work purge requires explicit test retention authority', true);
  process.env.AVA_PDF_TEST_RETENTION_ENABLED = '1';
  try {
    await delay(10);
    verify(
      'only deleted fixture operation is purged after grace',
      await purge(db, failed.id, 1),
    );
  } finally {
    delete process.env.AVA_PDF_TEST_RETENTION_ENABLED;
  }
  const retained = await runChild({
    action: 'report',
    operationId: failed.id,
    actorClerkId: admin.clerkUserId,
  });
  verify(
    'cost export retains known spending after library removal and operation purge',
    retained.result.value.cost.knownActualNano === '2000000' &&
      retained.result.value.cost.state === 'FINAL' &&
      (await db.pdfProviderCall.count({ where: { id: call.id } })) === 1,
  );
  await ledgerSums();
  await db.userRoleMembership.deleteMany({
    where: { userId: admin.id, role: 'ADMIN' },
  });
  const revoked = await runChild({
    action: 'report',
    operationId: failed.id,
    actorClerkId: admin.clerkUserId,
  });
  verify(
    'revoked admin cannot export costs',
    revoked.result.state === 'REFUSED' && revoked.result.status === 403,
  );
  await require('./copy.cjs')(db, s, verify);
  verify(
    'no external provider calls in parent or child',
    s.externalFetches() === 0,
  );
  return {
    status: 'PASS_PROVIDER_DATABASE_PROCESS_AND_LEDGER',
    checks,
    providerCalls: 0,
    syntheticTransportEntries: 1,
    syntheticActualNano: '2000000',
    scope:
      'Actual database and fresh-process boundaries; not OCR, live billing, Clerk/HTTP, browser or source-fidelity qualification; copy inspection is an authored boundary stub',
  };
}
main()
  .then((result) => {
    passed = result;
  })
  .catch((error) => {
    console.error(
      JSON.stringify({
        status: 'FAILED_PROVIDER_DATABASE_PROCESS_AND_LEDGER',
        completedChecks: checks,
        parentExternalFetchAttempts: s.externalFetches(),
      }),
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(
      [...children].map(
        (child) =>
          new Promise((resolve) => {
            child.once('exit', resolve);
            if (!child.kill('SIGKILL')) resolve();
          }),
      ),
    );
    try {
      if (adminId)
        await db.userRoleMembership.deleteMany({
          where: { userId: adminId, role: 'ADMIN' },
        });
      for (const id of principals)
        await db.pdfWorkerPrincipal.update({
          where: { id },
          data: { revokedAt: new Date() },
        });
    } finally {
      await db.$disconnect();
    }
  })
  .then(() => {
    if (passed && !process.exitCode) console.log(JSON.stringify(passed));
  })
  .catch((error) => {
    console.error(
      JSON.stringify({
        status: 'FAILED_PROVIDER_DATABASE_PROCESS_AND_LEDGER',
        completedChecks: checks,
        parentExternalFetchAttempts: s.externalFetches(),
      }),
    );
    console.error(error);
    process.exitCode = 1;
  });
