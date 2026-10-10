import type { PrismaService } from '../../../prisma/prisma.service';
import { settlePdfProvider } from './settle';
import { storeProviderPayload } from './payload';
import { costTransaction } from './cost-lock';
import { PdfProviderError } from './errors';
// Trusted operator receipt, never a reader request; no network lookup or resend.
export async function reconcilePdfProviderReceipt(
  prisma: PrismaService,
  callId: string,
  bytes: Buffer,
) {
  const receipt = await settlePdfProvider(prisma, callId, bytes);
  const call = await prisma.pdfProviderCall.findUniqueOrThrow({
    where: { id: callId },
    include: { grant: true },
  });
  if (
    await prisma.user.findUnique({
      where: { id: call.grant.ownerId },
      select: { id: true },
    })
  )
    await storeProviderPayload(
      prisma,
      call.grant.ownerId,
      callId,
      'RESPONSE',
      bytes,
    );
  return {
    callId,
    actualNano: receipt.actualNano.toString(),
    overage: receipt.overage,
  };
}
export function reactivateReconciledPdfRoute(
  prisma: PrismaService,
  routeId: string,
) {
  return costTransaction(prisma, async (tx) => {
    const route = await tx.pdfProviderRoute.findUniqueOrThrow({
      where: { id: routeId },
    });
    if (
      route.state !== 'PAUSED_UNCERTAIN' ||
      (await tx.pdfProviderCall.count({
        where: {
          grant: { routeId },
          OR: [
            { state: { in: ['DISPATCHING', 'UNCERTAIN'] } },
            { failureCode: 'PROVIDER_BOUND_EXCEEDED' },
          ],
        },
      }))
    )
      throw new PdfProviderError('PDF_PROVIDER_RECONCILIATION_REQUIRED');
    await tx.pdfProviderRoute.update({
      where: { id: routeId },
      data: { state: 'ACTIVE' },
    });
    return { routeId, state: 'ACTIVE' };
  });
}
