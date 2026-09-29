import type { PdfImportOperation } from '@prisma/client';
import type { Tx } from '../jobs/types';
import { databaseNow } from '../jobs/transaction';
import { costLock } from './cost-lock';
import { routePolicy } from './route-policy';
import { nanoValue } from './money';
import { PdfProviderError } from './errors';
import { requirePilotOperation } from './pilot-authority';
import { requirePilotBudgets } from './pilot-budgets';
export async function grantPdfProvider(
  tx: Tx,
  op: PdfImportOperation,
  routeId: string,
) {
  await costLock(tx);
  const now = await databaseNow(tx);
  const route = await tx.pdfProviderRoute.findUnique({
    where: { id: routeId },
  });
  if (
    !route ||
    route.state !== 'ACTIVE' ||
    route.verifiedAt > now ||
    route.validUntil <= now
  )
    throw new PdfProviderError('PDF_PROVIDER_ROUTE_UNAVAILABLE');
  const { config } = routePolicy(route.configuration, route.tariff);
  if (!config.authorizedSourceSha256.includes(op.sourceSha256))
    throw new PdfProviderError('PDF_PROVIDER_SOURCE_NOT_AUTHORIZED');
  const pilotOp = requirePilotOperation(config, route.mode, {
    operationId: op.id,
    ownerId: op.ownerId,
    sourceSha256: op.sourceSha256,
  });
  const scopes = [
    { scope: 'GLOBAL', scopeKey: 'ava' },
    { scope: 'ACCOUNT', scopeKey: route.accountKey },
    { scope: 'MODEL', scopeKey: route.modelId },
  ];
  const budgets = await tx.pdfProviderBudget.findMany({
    where: { OR: scopes },
  });
  if (budgets.length !== 3)
    throw new PdfProviderError('PDF_PROVIDER_BUDGET_UNCONFIGURED');
  requirePilotBudgets(config, budgets);
  const cap = nanoValue(
    pilotOp?.operationLimitNano ?? config.operationLimitNano,
  );
  const operationBudget = await tx.pdfProviderBudget.create({
    data: {
      scope: 'OPERATION',
      scopeKey: op.id,
      limitNano: cap,
      hardCeilingNano: cap,
      baselineEvidenceSha256: route.configurationSha256,
    },
  });
  return tx.pdfProviderGrant.create({
    data: {
      operationId: op.id,
      operationKey: op.id,
      ownerId: op.ownerId,
      sourceSha256: op.sourceSha256,
      configSha256: op.configSha256,
      routeId,
      budgetIds: [...budgets.map((b) => b.id), operationBudget.id],
    },
  });
}
