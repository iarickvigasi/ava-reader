import type { RouteConfiguration } from './types';
import { PdfProviderError } from './errors';
/** A task may narrow its explicitly authorized prompt ceiling, never widen it. */
export function outputTokenLimit(
  config: RouteConfiguration,
  prompt: string,
  requested?: number,
) {
  const limits = config.maxOutputTokensByPrompt;
  const ceiling =
    limits && Object.hasOwn(limits, prompt)
      ? limits[prompt]
      : config.maxOutputTokens;
  if (requested !== undefined && requested > ceiling)
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_LIMIT');
  return requested ?? ceiling;
}
