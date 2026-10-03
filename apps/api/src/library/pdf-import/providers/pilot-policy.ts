import type { RouteConfiguration, RouteTariff } from './types';
import { nanoValue, usdToNano } from './money';
import { PdfProviderError } from './errors';
export function validatePilotPolicy(
  config: RouteConfiguration,
  tariff: RouteTariff,
  maximumNano: bigint,
) {
  const pilot = config.pilotInventory;
  if (!pilot) return;
  const operations = pilot.operations,
    tasks = operations.flatMap((op) => op.tasks),
    sources = new Set(operations.map((op) => op.sourceSha256));
  if (
    !config.zeroDataRetention ||
    config.maxImages !== 1 ||
    usdToNano(tariff.requestUsd) !== 0n ||
    tasks.length !== pilot.maxRequests ||
    new Set(tasks.map((t) => t.taskId)).size !== tasks.length ||
    new Set(operations.map((op) => op.operationId)).size !==
      operations.length ||
    sources.size !== operations.length ||
    config.authorizedSourceSha256.length !== sources.size ||
    config.authorizedSourceSha256.some((s) => !sources.has(s)) ||
    maximumNano * BigInt(tasks.length) > nanoValue(pilot.totalLimitNano) ||
    operations.some(
      (op) =>
        nanoValue(op.operationLimitNano) !==
        maximumNano * BigInt(op.tasks.length),
    )
  )
    throw new PdfProviderError('PDF_PROVIDER_PILOT_INVALID');
}
