import { resolveFontSizeScale } from './font-size';
import { resolveFontWeightValue } from './font-weight';

// An explicit default resets an inherited value; absence never does.
export function explicitFontWeight(value?: string): number | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'normal' || normalized === '400') return 400;
  return normalized ? resolveFontWeightValue(normalized) : null;
}
export function explicitFontSize(value?: string): number | null {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized &&
    /^(?:1(?:\.0+)?(?:em|rem)|100(?:\.0+)?%|medium)$/.test(normalized)
  )
    return 1;
  return normalized ? resolveFontSizeScale(normalized) : null;
}
