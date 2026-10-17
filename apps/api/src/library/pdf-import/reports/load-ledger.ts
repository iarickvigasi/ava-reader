import type { Tx } from '../jobs/types';
import { CostProjectionBuilder, type ReportCall } from './cost-projection';

const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
export async function loadConversionProjection(
  tx: Tx,
  operationKey: string,
  terminal: boolean,
  page = { offset: 0, limit: 0 },
  verifiedAbsentLedger = true,
) {
  const grant = await tx.pdfProviderGrant.findUnique({
    where: { operationKey },
    include: { route: true },
  });
  const builder = new CostProjectionBuilder(page);
  if (!grant) return builder.finish(terminal, verifiedAbsentLedger);
  let after: string | undefined;
  for (;;) {
    const calls = await tx.pdfProviderCall.findMany({
      where: { grantId: grant.id, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' },
      take: 250,
      include: {
        events: {
          where: { kind: { in: ['RESERVED', 'SETTLED', 'BOUND_EXCEEDED'] } },
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
    });
    for (const call of calls) {
      const settled = call.events.filter(
        (event) =>
          ['SETTLED', 'BOUND_EXCEEDED'].includes(event.kind) &&
          event.evidenceSha256 === call.receiptSha256,
      );
      const usage =
        settled.length === 1 &&
        settled[0].details &&
        typeof settled[0].details === 'object' &&
        !Array.isArray(settled[0].details)
          ? settled[0].details
          : {};
      const reserved = call.events.find((event) => event.kind === 'RESERVED');
      const details =
        reserved?.details &&
        typeof reserved.details === 'object' &&
        !Array.isArray(reserved.details)
          ? reserved.details
          : {};
      const row: ReportCall = {
        id: call.id,
        state: call.state,
        reservedNano: call.reservedNano,
        actualNano: call.actualNano,
        requestSha256: call.requestSha256,
        receiptSha256: call.receiptSha256,
        providerGenerationId: call.providerGenerationId,
        modelId: grant.route.modelId,
        routeProvider: grant.route.providerSlug,
        routeId: grant.routeId,
        tariffSha256: grant.route.tariffSha256,
        configurationSha256: grant.route.configurationSha256,
        purpose:
          details.purpose === 'transcribe_region' ||
          details.purpose === 'resolve_structure'
            ? details.purpose
            : null,
        stage:
          typeof details.stage === 'string' &&
          /^[A-Z_]{1,40}$/.test(details.stage)
            ? details.stage
            : null,
        promptTokens: count(usage.promptTokens),
        completionTokens: count(usage.completionTokens),
      };
      builder.add(row);
    }
    if (calls.length < 250) break;
    after = calls.at(-1)!.id;
  }
  return builder.finish(terminal);
}
