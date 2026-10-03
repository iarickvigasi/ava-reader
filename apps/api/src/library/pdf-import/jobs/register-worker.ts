import type { PrismaService } from '../../../prisma/prisma.service';
import { PdfJobError } from './errors';
import { secretDigest } from './secrets';
export type PdfWorkerMode = 'native' | 'stub' | 'replay' | 'live';
export async function registerPdfWorker(
  prisma: PrismaService,
  input: {
    name: string;
    workerFingerprint: string;
    token: string;
    modes?: PdfWorkerMode[];
  },
) {
  const modes = input.modes ?? ['native'];
  if (
    !/^[A-Za-z0-9_-]{32,256}$/.test(input.token) ||
    !/^[a-f0-9]{64}$/.test(input.workerFingerprint) ||
    !input.name.trim() ||
    input.name.length > 100 ||
    !modes.length ||
    modes.length > 4 ||
    new Set(modes).size !== modes.length ||
    modes.some((mode) => !['native', 'stub', 'replay', 'live'].includes(mode))
  )
    throw new PdfJobError('PDF_WORKER_REGISTRATION_INVALID');
  const record = await prisma.pdfWorkerPrincipal.create({
    data: {
      name: input.name,
      tokenHash: secretDigest(input.token),
      workerFingerprint: input.workerFingerprint,
      modes,
    },
    select: { id: true },
  });
  return { principalId: record.id };
}
