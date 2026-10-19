// Trusted operator process only. Provider calls require source, route and ledger authority; no credential logging.
const { setTimeout: delay } = require('node:timers/promises');
const { PrismaService } = require('../dist/prisma/prisma.service');
const {
  runtimeConfigFromEnvironment,
} = require('../dist/pdf-conversion/runtime/runtime-config');
const { executeOne } = require('../dist/pdf-conversion/runtime/execute-one');
const {
  processNextCandidate,
} = require('../dist/library/pdf-import/publication/process-next');
const {
  reapPrivateInputs,
} = require('../dist/pdf-conversion/runtime/reap-private-inputs');
const {
  pythonSemanticValidator,
} = require('../dist/pdf-conversion/contracts/python-semantic-validator');

let phase = 'configuration';
async function main() {
  const action = process.argv[2];
  if (!['once', 'serve'].includes(action) || process.argv.length !== 3)
    throw new Error('WORKER_CONFIGURATION_INVALID');
  const config = runtimeConfigFromEnvironment();
  const credential = {
    principalId: process.env.AVA_PDF_WORKER_PRINCIPAL,
    token: process.env.AVA_PDF_WORKER_TOKEN,
  };
  if (!credential.principalId || !credential.token || !process.env.DATABASE_URL)
    throw new Error('WORKER_CONFIGURATION_INVALID');
  const semantic = pythonSemanticValidator(
    process.env.AVA_PDF_CONTRACT_PYTHON ?? '',
  );
  const stop = new AbortController();
  process.once('SIGTERM', () => stop.abort());
  process.once('SIGINT', () => stop.abort());
  const prisma = new PrismaService();
  try {
    phase = 'private_input_cleanup';
    await reapPrivateInputs(config);
    do {
      phase = 'claim_and_execute';
      const result = await executeOne(
        prisma,
        credential,
        config,
        semantic,
        stop.signal,
      );
      process.stdout.write(
        `${JSON.stringify({ event: 'pdf_worker_tick', ...result })}\n`,
      );
      if (!stop.signal.aborted) {
        phase = 'candidate_publication';
        const publication = await processNextCandidate(prisma, credential, {
          runtime: config,
          semantic,
          qualificationId: process.env.AVA_PDF_READER_QUALIFICATION_ID,
          signal: stop.signal,
        });
        process.stdout.write(
          `${JSON.stringify({ event: 'pdf_candidate_tick', ...publication })}\n`,
        );
      }
      if (action === 'once') break;
      await delay(1000, undefined, { signal: stop.signal }).catch(
        () => undefined,
      );
    } while (!stop.signal.aborted);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  const cause =
    error instanceof Error &&
    typeof error.code === 'string' &&
    /^(P[0-9]{4}|PDF_JOB_AUTHORITY_INVALID|ECONNRESET|ETIMEDOUT)$/.test(
      error.code,
    )
      ? error.code
      : 'WORKER_ERROR';
  process.stderr.write(
    JSON.stringify({
      event: 'pdf_worker_failed',
      code: 'WORKER_UNAVAILABLE',
      phase,
      cause,
    }) + '\n',
  );
  process.exitCode = 1;
});
