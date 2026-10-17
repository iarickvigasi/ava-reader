import type { PrismaService } from '../../../prisma/prisma.service';
import { storeProviderPayload } from './payload';
// Failure to retain private evidence cannot undo the durable unknown-cost reservation.
export async function preserveUnconfirmedReceipt(
  prisma: PrismaService,
  ownerId: string,
  callId: string,
  response: Buffer | undefined,
) {
  if (!response || response.length > 16 * 1024 * 1024) return;
  try {
    if (
      await prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true },
      })
    )
      await storeProviderPayload(
        prisma,
        ownerId,
        callId,
        'UNCONFIRMED',
        response,
      );
  } catch {
    /* Account deletion and storage failure leave the call blocked for investigation. */
  }
}
