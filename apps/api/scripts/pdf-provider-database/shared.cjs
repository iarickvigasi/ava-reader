'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const api = path.resolve(__dirname, '../..');
const req = createRequire(path.join(api, 'package.json'));
const load = (name) => req(path.join(api, 'dist', name + '.js'));
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
let fetches = 0;
const url = new URL(process.env.AVA_PDF_DATABASE_TEST_URL || 'http://invalid');
assert.equal(url.protocol, 'postgresql:');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.pathname, '/ava_pdf_provider_ci');
assert.equal(url.username, 'postgres');
assert.equal(url.password, 'ava-ephemeral-test-only');
assert.match(url.port, /^\d{4,5}$/);
// The launcher supplies a new disposable database, never the user's .env URL.
for (const key of Object.keys(process.env)) {
  if (
    key.startsWith('AVA_') ||
    /^(OPENROUTER|OPENAI|ANTHROPIC|GEMINI|GOOGLE|CLERK|DATABASE_URL)/.test(key)
  )
    delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: 'test',
  DOTENV_CONFIG_PATH: '/dev/null',
  DATABASE_URL: url.href,
  AVA_PDF_TEST_HOOKS: '1',
  AVA_PDF_TEST_PROVIDER_MODE: 'stub',
});
global.fetch = async () => {
  fetches++;
  throw new Error('EXTERNAL_FETCH_FORBIDDEN');
};
req('reflect-metadata');
const { PrismaClient } = req('@prisma/client');
const { PrismaPg } = req('@prisma/adapter-pg');
const jobs = load('library/pdf-import/jobs/index');
const providers = load('library/pdf-import/providers/index');
const fixture = load('library/pdf-import/providers/test-fixtures');
const fixturePath = path.resolve(
  api,
  '../../packages/pdf-epub/tests/reconstruction_v2/fixtures/native.pdf',
);
const source = fs.readFileSync(fixturePath),
  sourceSha = hash(source);
function client() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url.href,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
    }),
  });
}
function policy(leaseMs = 30000) {
  process.env.AVA_PDF_TEST_JOB_POLICY = JSON.stringify({
    leaseMs,
    totalTimeoutMs: 120000,
    retryDelayMs: 0,
  });
}
async function budget(db, scope, scopeKey, limitNano = '10000000000') {
  return providers.registerPdfBudget(db, {
    scope,
    scopeKey,
    limitNano,
    hardCeilingNano: limitNano,
    baselineNano: '0',
    baselineEvidenceSha256: 'f'.repeat(64),
  });
}
async function route(db, accountKey) {
  const result = await providers.registerPdfRoute(db, {
    accountKey,
    modelId: fixture.route.modelId,
    providerSlug: fixture.route.providerSlug,
    mode: 'stub',
    configuration: { ...fixture.config, authorizedSourceSha256: [sourceSha] },
    tariff: fixture.tariff,
    verifiedAt: new Date(Date.now() - 1000).toISOString(),
    validUntil: new Date(Date.now() + 3600000).toISOString(),
  });
  return db.pdfProviderRoute.findUniqueOrThrow({
    where: { id: result.routeId },
  });
}
async function imported(db, label, routeId, leaseMs = 30000) {
  policy(leaseMs);
  const owner = await db.user.create({
    data: {
      clerkUserId: 'provider-ci-' + label,
      primaryEmail: label + '@provider-ci.invalid',
    },
  });
  const key = 'provider-ci-' + label + '-request-0001';
  const admissionApi = load('library/pdf-import/reports/admission');
  const admission = await admissionApi.beginConversionAdmission(
    db,
    owner.id,
    key,
  );
  const artifact = await load(
    'library/pdf-import/artifacts/stage-source',
  ).stagePdfSource({
    prisma: db,
    userId: owner.id,
    sourceSha256: sourceSha,
    file: { buffer: source, originalname: 'Authored native fixture.pdf' },
  });
  const profile = load('library/pdf-import/admission/profile');
  // This existing authored fixture has eight pages; admission/OCR are separate checks.
  const op = await db.$transaction((tx) =>
    load('library/pdf-import/operations/accept-import').acceptPdfImport(
      tx,
      {
        userId: owner.id,
        artifact,
        filename: 'Authored native fixture.pdf',
        inspection: { page_count: 8, metadata: {} },
        idempotencyKey: key,
        sourceSha256: sourceSha,
        requestSha256: hash(Buffer.from(label)),
        configSha256: profile.PDF_CONFIG_HASH,
        configuration: profile.PDF_IMPORT_PROFILE,
      },
      admission.conversionId,
    ),
  );
  await admissionApi.completeConversionAdmission(db, admission);
  await load(
    'library/pdf-import/providers/attach-test-grant',
  ).attachTestProviderGrant(db, op.operationId, routeId);
  return { owner, op };
}
async function worker(db, label) {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    ...(await jobs.registerPdfWorker(db, {
      name: 'provider-ci-' + label,
      token,
      workerFingerprint: 'e'.repeat(64),
      modes: ['stub'],
    })),
    token,
  };
}
const task = (id) => ({
  ...structuredClone(fixture.task),
  taskId: id,
  sourceSha256: sourceSha,
});
async function report(db, operationId, actorClerkId) {
  const record = await db.pdfConversionInvestigation.findFirstOrThrow({
    where: { operationKey: operationId },
  });
  const { ConfigService } = req('@nestjs/config');
  const { ClerkAuthService } = load('auth/clerk-auth.service');
  const { UsersService } = load('users/users.service');
  const { PdfConversionReportsController } = load(
    'library/pdf-import/pdf-conversion-reports.controller',
  );
  const users = new UsersService(
    db,
    new ClerkAuthService(new ConfigService({})),
  );
  const controller = new PdfConversionReportsController(db, users);
  // Service/controller boundary with real DB roles; this is not a Clerk/HTTP login test.
  return controller.export(
    { auth: { clerkUserId: actorClerkId } },
    record.id,
    undefined,
    '100',
  );
}
module.exports = {
  assert,
  req,
  load,
  client,
  jobs,
  providers,
  fixture,
  budget,
  route,
  imported,
  worker,
  task,
  sourceSha,
  report,
  url: url.href,
  externalFetches: () => fetches,
};
