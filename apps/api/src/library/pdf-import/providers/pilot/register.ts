import type { PrismaService } from '../../../../prisma/prisma.service';
import { secretDigest } from '../../jobs/secrets';
import { loadAuthoredPilotRoute } from './route';
import { PdfProviderError } from '../errors';
export async function registerAuthoredPilotWorker(
  prisma: PrismaService,
  routeId: string,
  token: string,
) {
  const { pilot } = await loadAuthoredPilotRoute(prisma, routeId);
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token))
    throw new PdfProviderError('PDF_PROVIDER_PILOT_UNAUTHORIZED');
  const row = await prisma.pdfWorkerPrincipal.create({
    data: {
      name: 'authored-pdf-pilot',
      tokenHash: secretDigest(token),
      workerFingerprint: pilot.workerFingerprint,
      modes: ['live'],
    },
    select: { id: true },
  });
  return { principalId: row.id };
}
