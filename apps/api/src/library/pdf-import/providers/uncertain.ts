import type { PrismaService } from '../../../prisma/prisma.service';
import { costTransaction } from './cost-lock';
export function markPdfProviderUncertain(
  prisma: PrismaService,
  callId: string,
) {
  return costTransaction(prisma, async (tx) => {
    const call = await tx.pdfProviderCall.findUniqueOrThrow({
      where: { id: callId },
      include: { grant: true },
    });
    if (call.state !== 'DISPATCHING' && call.state !== 'UNCERTAIN')
      return { state: call.state };
    if (call.state === 'DISPATCHING') {
      await tx.pdfProviderCall.update({
        where: { id: call.id },
        data: { state: 'UNCERTAIN', failureCode: 'OUTCOME_UNKNOWN' },
      });
      await tx.pdfProviderEvent.create({
        data: {
          callId: call.id,
          kind: 'OUTCOME_UNKNOWN',
          evidenceSha256: call.requestSha256,
          details: {},
        },
      });
    }
    await tx.pdfProviderRoute.updateMany({
      where: { id: call.grant.routeId, state: 'ACTIVE' },
      data: { state: 'PAUSED_UNCERTAIN' },
    });
    return { state: 'UNCERTAIN' };
  });
}
