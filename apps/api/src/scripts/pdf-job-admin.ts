import 'reflect-metadata';
import { PrismaService } from '../prisma/prisma.service';
import {
  registerPdfWorker,
  revokePdfWorker,
  stopPdfJob,
  pdfJobMetrics,
} from '../library/pdf-import/jobs';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_REQUIRED');
  const [command, arg, fingerprint, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    !['register', 'revoke', 'stop', 'metrics'].includes(command ?? '') ||
    (command === 'register'
      ? !arg || !fingerprint
      : command === 'metrics'
        ? Boolean(arg)
        : !arg || Boolean(fingerprint))
  )
    throw new Error('ARGUMENTS_INVALID');
  const prisma = new PrismaService();
  try {
    const result =
      command === 'register'
        ? await registerPdfWorker(prisma, {
            name: arg,
            workerFingerprint: fingerprint,
            token: process.env.AVA_PDF_WORKER_TOKEN ?? '',
          })
        : command === 'revoke'
          ? await revokePdfWorker(prisma, arg)
          : command === 'stop'
            ? await stopPdfJob(prisma, arg)
            : await pdfJobMetrics(prisma);
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write('PDF_JOB_ADMIN_FAILED\n');
  process.exitCode = 1;
});
