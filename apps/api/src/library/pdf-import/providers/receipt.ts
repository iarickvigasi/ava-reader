import { z } from 'zod';
import { usdToNano } from './money';
import { PdfProviderError } from './errors';
import { checksumBuffer } from '../../../shared/blob-utils';
const receiptSchema = z.object({
  id: z.string().min(1).max(200),
  model: z.string(),
  usage: z.object({
    cost: z.union([z.number(), z.string()]),
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
  }),
  choices: z.unknown().optional(),
});
export function parseProviderReceipt(bytes: Buffer, modelId: string) {
  if (bytes.length > 16 * 1024 * 1024)
    throw new PdfProviderError('PDF_PROVIDER_RECEIPT_INVALID');
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new PdfProviderError('PDF_PROVIDER_RECEIPT_INVALID');
  }
  const parsed = receiptSchema.safeParse(raw);
  if (!parsed.success || parsed.data.model !== modelId)
    throw new PdfProviderError('PDF_PROVIDER_RECEIPT_INVALID');
  const value = parsed.data;
  const choice = z
    .array(
      z.object({
        finish_reason: z.string().nullable(),
        message: z.object({ content: z.string().nullable() }),
      }),
    )
    .length(1)
    .safeParse(value.choices);
  return {
    generationId: value.id,
    actualNano: usdToNano(value.usage.cost),
    receiptSha256: checksumBuffer(bytes),
    promptTokens: value.usage.prompt_tokens,
    completionTokens: value.usage.completion_tokens,
    output: choice.success ? choice.data[0].message.content : null,
    complete: choice.success && choice.data[0].finish_reason === 'stop',
  };
}
