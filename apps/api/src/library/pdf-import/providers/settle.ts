import type { PrismaService } from '../../../prisma/prisma.service';
import { databaseNow } from '../jobs/transaction';
import { costTransaction } from './cost-lock';
import { parseProviderReceipt } from './receipt';
import { PdfProviderError } from './errors';
import { routePolicy } from './route-policy';
import { dispatchedOutputLimit } from './dispatched-output-limit';
import { recordPdfProviderEvent } from '../reports/provider-event';
export async function settlePdfProvider(
  prisma: PrismaService,
  callId: string,
  response: Buffer,
) {
  if (response.length > 16 * 1024 * 1024)
    throw new PdfProviderError('PDF_PROVIDER_RECEIPT_INVALID');
  const bytes = Buffer.from(response);
  return costTransaction(prisma, async (tx) => {
    const call = await tx.pdfProviderCall.findUniqueOrThrow({
      where: { id: callId },
      include: {
        grant: { include: { route: true } },
        allocations: true,
        payloads: { where: { kind: 'REQUEST' }, include: { blob: true } },
      },
    });
    const receipt = parseProviderReceipt(bytes, call.grant.route.modelId),
      now = await databaseNow(tx);
    if (call.state === 'SETTLED') {
      if (
        call.receiptSha256 !== receipt.receiptSha256 ||
        call.actualNano !== receipt.actualNano ||
        call.providerGenerationId !== receipt.generationId
      )
        throw new PdfProviderError('PDF_PROVIDER_RECEIPT_CONFLICT');
      return {
        ...receipt,
        overage: call.failureCode === 'PROVIDER_BOUND_EXCEEDED',
        boundUnverified:
          call.failureCode === 'PROVIDER_OUTPUT_BOUND_UNVERIFIED',
      };
    }
    if (!['DISPATCHING', 'UNCERTAIN'].includes(call.state))
      throw new PdfProviderError('PDF_PROVIDER_RECEIPT_UNAUTHORIZED');
    if (call.allocations.length !== 4)
      throw new PdfProviderError('PDF_PROVIDER_ACCOUNTING_INVALID');
    for (const allocation of call.allocations) {
      await tx.pdfProviderBudget.update({
        where: { id: allocation.budgetId },
        data: {
          reservedNano: { decrement: allocation.reservedNano },
          actualNano: { increment: receipt.actualNano },
        },
      });
      await tx.pdfProviderAllocation.update({
        where: { id: allocation.id },
        data: { reservedNano: 0n, actualNano: receipt.actualNano },
      });
    }
    const policy = routePolicy(
      call.grant.route.configuration,
      call.grant.route.tariff,
    );
    const outputBound = dispatchedOutputLimit(call, policy.config);
    const boundUnverified = outputBound.status === 'UNVERIFIED';
    const overage =
      receipt.actualNano > call.reservedNano ||
      receipt.promptTokens > policy.config.maxContextTokens ||
      receipt.completionTokens > outputBound.limit;
    await tx.pdfProviderCall.update({
      where: { id: call.id },
      data: {
        state: 'SETTLED',
        actualNano: receipt.actualNano,
        providerGenerationId: receipt.generationId,
        receiptSha256: receipt.receiptSha256,
        settledAt: now,
        failureCode: overage
          ? 'PROVIDER_BOUND_EXCEEDED'
          : boundUnverified
            ? 'PROVIDER_OUTPUT_BOUND_UNVERIFIED'
            : null,
      },
    });
    await recordPdfProviderEvent(tx, {
      data: {
        callId: call.id,
        kind: overage
          ? 'BOUND_EXCEEDED'
          : boundUnverified
            ? 'BOUND_UNVERIFIED'
            : 'SETTLED',
        evidenceSha256: receipt.receiptSha256,
        details: {
          generationId: receipt.generationId,
          actualNano: receipt.actualNano.toString(),
          promptTokens: receipt.promptTokens,
          completionTokens: receipt.completionTokens,
          outputLimit: outputBound.limit,
          outputLimitProof: outputBound.status,
        },
      },
    });
    if (overage || boundUnverified)
      await tx.pdfProviderRoute.update({
        where: { id: call.grant.routeId },
        data: { state: overage ? 'PAUSED_OVERAGE' : 'PAUSED_BOUND_UNVERIFIED' },
      });
    return { ...receipt, overage, boundUnverified };
  });
}
