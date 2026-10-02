import { PdfJobError } from './errors';
export function configuredPdfMode(): 'native' | 'stub' | 'replay' | 'live' {
  const mode = process.env.AVA_PDF_TEST_PROVIDER_MODE;
  const route = process.env.AVA_PDF_PROVIDER_ROUTE_ID;
  if (route !== undefined) {
    if (mode || !/^[A-Za-z0-9_-]{1,100}$/.test(route))
      throw new PdfJobError('PDF_PROVIDER_CONFIGURATION_INVALID');
    return 'live';
  }
  if (!mode) return 'native';
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.AVA_PDF_TEST_HOOKS !== '1' ||
    !['stub', 'replay'].includes(mode)
  )
    throw new PdfJobError('PDF_TEST_HOOKS_DISABLED');
  return mode as 'stub' | 'replay';
}
