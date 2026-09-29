import { PdfJobError } from './errors';
export function configuredPdfMode(): 'native' | 'stub' | 'replay' {
  const mode = process.env.AVA_PDF_TEST_PROVIDER_MODE;
  if (!mode) return 'native';
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.AVA_PDF_TEST_HOOKS !== '1' ||
    !['stub', 'replay'].includes(mode)
  )
    throw new PdfJobError('PDF_TEST_HOOKS_DISABLED');
  return mode as 'stub' | 'replay';
}
