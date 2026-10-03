import { readFileSync, statSync } from 'node:fs';
import { z } from 'zod';
import { PdfProviderError } from './errors';
export const budgetInput = z
  .object({
    scope: z.enum(['GLOBAL', 'ACCOUNT', 'MODEL', 'OPERATION']),
    scopeKey: z.string(),
    limitNano: z.string(),
    hardCeilingNano: z.string(),
    baselineNano: z.string(),
    baselineEvidenceSha256: z.string(),
  })
  .strict();
export const routeInput = z
  .object({
    accountKey: z.string(),
    modelId: z.string(),
    providerSlug: z.string(),
    mode: z.enum(['live', 'stub', 'replay']),
    configuration: z.unknown(),
    tariff: z.unknown(),
    verifiedAt: z.string(),
    validUntil: z.string(),
  })
  .strict();
export function adminBytes(path: string, limit = 16777216) {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size < 1 || stat.size > limit)
    throw new PdfProviderError('PDF_PROVIDER_ADMIN_INPUT_INVALID');
  const bytes = readFileSync(path);
  if (bytes.length > limit)
    throw new PdfProviderError('PDF_PROVIDER_ADMIN_INPUT_INVALID');
  return bytes;
}
export function adminJson(path: string): unknown {
  return JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(adminBytes(path, 1048576)),
  );
}
