import { PdfProviderError } from './errors';
// All storage/accounting uses integer nanodollars; round upward at the boundary.
export function usdToNano(value: unknown): bigint {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new PdfProviderError('PDF_PROVIDER_COST_INVALID');
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match || String(value).length > 80)
    throw new PdfProviderError('PDF_PROVIDER_COST_INVALID');
  const exponent = Number(match[3] ?? 0),
    fraction = match[2] ?? '';
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 30)
    throw new PdfProviderError('PDF_PROVIDER_COST_INVALID');
  const digits = BigInt(match[1] + fraction),
    shift = 9 + exponent - fraction.length;
  const nano =
    shift >= 0
      ? digits * 10n ** BigInt(shift)
      : (digits + 10n ** BigInt(-shift) - 1n) / 10n ** BigInt(-shift);
  if (nano > 1_000_000_000_000_000n)
    throw new PdfProviderError('PDF_PROVIDER_COST_INVALID');
  return nano;
}
export function nanoValue(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,15})$/.test(value))
    throw new PdfProviderError('PDF_PROVIDER_COST_INVALID');
  return BigInt(value);
}
export function tokenCost(ratePerMillion: bigint, tokens: number) {
  return (ratePerMillion * BigInt(tokens) + 999999n) / 1000000n;
}
