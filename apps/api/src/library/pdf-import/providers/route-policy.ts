import { z } from 'zod';
import { pilotInventorySchema } from './pilot-schema';
import { validatePilotPolicy } from './pilot-policy';
import { PdfProviderError } from './errors';
import type { RouteConfiguration, RouteTariff } from './types';
import { nanoValue, tokenCost, usdToNano } from './money';
const hash = z.string().regex(/^[a-f0-9]{64}$/),
  decimal = z.string().regex(/^\d+(?:\.\d{1,15})?$/);
const configSchema = z
  .object({
    version: z.literal(1),
    maxContextTokens: z.number().int().min(1).max(4_000_000),
    maxOutputTokens: z.number().int().min(1).max(65536),
    maxRequestBytes: z
      .number()
      .int()
      .min(1)
      .max(16 * 1024 * 1024),
    maxResponseBytes: z
      .number()
      .int()
      .min(1)
      .max(16 * 1024 * 1024),
    maxImages: z.number().int().min(0).max(8),
    timeoutMs: z.number().int().min(100).max(300000),
    dataCollection: z.literal('deny'),
    zeroDataRetention: z.boolean(),
    promptHashes: z.record(z.string(), hash),
    schemaHashes: z.record(z.string(), hash),
    operationLimitNano: z.string(),
    authorizedSourceSha256: z.array(hash).min(1).max(500),
    pilotInventory: pilotInventorySchema.optional(),
  })
  .strict();
const tariffSchema = z
  .object({
    version: z.literal(1),
    promptPerMillionUsd: decimal,
    completionPerMillionUsd: decimal,
    requestUsd: decimal,
    imageUsd: decimal,
    evidenceSha256: hash,
    sourceUrl: z.string().url(),
  })
  .strict();
export function routePolicy(
  configuration: unknown,
  tariff: unknown,
): { config: RouteConfiguration; tariff: RouteTariff; maximumNano: bigint } {
  const c = configSchema.safeParse(configuration),
    t = tariffSchema.safeParse(tariff);
  if (
    !c.success ||
    !t.success ||
    c.data.maxOutputTokens > c.data.maxContextTokens ||
    !Object.keys(c.data.promptHashes).length ||
    !Object.keys(c.data.schemaHashes).length
  )
    throw new PdfProviderError('PDF_PROVIDER_ROUTE_INVALID');
  nanoValue(c.data.operationLimitNano);
  const maximumNano =
    tokenCost(usdToNano(t.data.promptPerMillionUsd), c.data.maxContextTokens) +
    tokenCost(
      usdToNano(t.data.completionPerMillionUsd),
      c.data.maxOutputTokens,
    ) +
    usdToNano(t.data.requestUsd) +
    usdToNano(t.data.imageUsd) * BigInt(c.data.maxImages);
  if (maximumNano < 1n)
    throw new PdfProviderError('PDF_PROVIDER_ROUTE_INVALID');
  validatePilotPolicy(c.data, t.data, maximumNano);
  return { config: c.data, tariff: t.data, maximumNano };
}
