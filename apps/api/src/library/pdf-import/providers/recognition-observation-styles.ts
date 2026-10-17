import { PdfProviderError } from './errors';
export const OBSERVED_FONT_FAMILIES = [
  'serif',
  'sans-serif',
  'monospace',
] as const;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
// Called only on a freshly parsed observation-2 packet. Canonical validation still
// rejects every other unknown key; source text and all other style values survive.
export function projectObservationStyles(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(projectObservationStyles);
    return;
  }
  if (!record(value)) return;
  if (record(value.style)) {
    const style = value.style;
    if (Object.hasOwn(style, 'id'))
      throw new PdfProviderError('PDF_PROVIDER_OUTPUT_INVALID');
    if (Object.hasOwn(style, 'font_family_role')) {
      const family = style.font_family_role;
      if (
        Object.hasOwn(style, 'family') ||
        !OBSERVED_FONT_FAMILIES.some((known) => known === family)
      )
        throw new PdfProviderError('PDF_PROVIDER_OUTPUT_INVALID');
      style.family = family;
      delete style.font_family_role;
    }
  }
  Object.values(value).forEach(projectObservationStyles);
}
