import { z } from 'zod';
import type { RouteConfiguration } from './types';
import { nanoValue } from './money';
import { PdfProviderError } from './errors';
export const importPolicySchema = z
  .object({
    version: z.literal(1),
    workerFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    profileId: z.string().min(1).max(100),
    configSha256: z.string().regex(/^[a-f0-9]{64}$/),
    maxRequestsPerOperation: z.number().int().min(1).max(2000),
  })
  .strict();
export type ImportPolicy = z.infer<typeof importPolicySchema>;
export function validateImportPolicy(config: RouteConfiguration) {
  if (!config.importPolicy) {
    if (!config.authorizedSourceSha256.length)
      throw new PdfProviderError('PDF_PROVIDER_ROUTE_INVALID');
    return;
  }
  if (
    config.pilotInventory ||
    config.authorizedSourceSha256.length ||
    !config.zeroDataRetention ||
    nanoValue(config.operationLimitNano) > 10_000_000_000n
  )
    throw new PdfProviderError('PDF_PROVIDER_IMPORT_POLICY_INVALID');
}
export function requireImportBudgets(
  config: RouteConfiguration,
  budgets: {
    scope: string;
    limitNano: bigint;
    hardCeilingNano: bigint;
  }[],
) {
  if (!config.importPolicy) return;
  if (
    budgets.some(
      (b) =>
        b.limitNano > b.hardCeilingNano ||
        (b.scope === 'MODEL' && b.hardCeilingNano > 10_000_000_000n),
    )
  )
    throw new PdfProviderError('PDF_PROVIDER_IMPORT_BUDGET_INVALID');
}
