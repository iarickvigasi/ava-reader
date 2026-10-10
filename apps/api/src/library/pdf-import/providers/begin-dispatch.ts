import type { PrismaService } from '../../../prisma/prisma.service';
import type { AttemptAuthority } from '../jobs';
import { jobTransaction } from '../jobs/transaction';
import { costLock } from './cost-lock';
import { loadProviderGrant } from './load-grant';
import { PdfProviderError } from './errors';
import { requirePilotCall } from './pilot-authority';
import { routePolicy } from './route-policy';
import { recordPdfProviderEvent } from '../reports/provider-event';
export function beginPdfDispatch(
  prisma: PrismaService,
  authority: AttemptAuthority,
  callId: string,
) {
  const credential = { ...authority };
  return jobTransaction(prisma, async (tx) => {
    await loadProviderGrant(tx, credential);
    await costLock(tx);
    const { attempt, grant, now } = await loadProviderGrant(tx, credential);
    const call = await tx.pdfProviderCall.findUnique({
      where: { id: callId },
      include: { payloads: true },
    });
    if (!call || call.grantId !== grant.id)
      throw new PdfProviderError('PDF_PROVIDER_NOT_AUTHORIZED');
    requirePilotCall(
      routePolicy(grant.route.configuration, grant.route.tariff).config,
      grant.operationKey,
      call,
    );
    if (call.state !== 'RESERVED')
      throw new PdfProviderError(
        call.state === 'DISPATCHING'
          ? 'PDF_PROVIDER_CALL_IN_PROGRESS'
          : 'PDF_PROVIDER_OUTCOME_UNCERTAIN',
      );
    const request = call.payloads.find((p) => p.kind === 'REQUEST');
    if (
      !request ||
      request.ownerId !== grant.ownerId ||
      request.checksum !== call.requestSha256
    )
      throw new PdfProviderError('PDF_PROVIDER_PAYLOAD_INVALID');
    await tx.pdfProviderCall.update({
      where: { id: call.id },
      data: {
        state: 'DISPATCHING',
        dispatchedAt: now,
        dispatchAttemptId: attempt.id,
      },
    });
    await recordPdfProviderEvent(tx, {
      data: {
        callId: call.id,
        kind: 'DISPATCH_INTENT',
        evidenceSha256: call.requestSha256,
        details: { attemptId: attempt.id },
      },
    });
    await loadProviderGrant(tx, credential);
    return { callId: call.id, requestSha256: call.requestSha256 };
  });
}
