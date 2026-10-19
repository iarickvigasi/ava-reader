import { PdfPublicationError } from './errors';
export function validationLeaseMs() {
  const value = process.env.AVA_PDF_TEST_VALIDATION_LEASE_MS;
  if (value === undefined) return 30000;
  const milliseconds = Number(value);
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.AVA_PDF_TEST_HOOKS !== '1' ||
    !Number.isInteger(milliseconds) ||
    milliseconds < 100 ||
    milliseconds > 30000
  )
    throw new PdfPublicationError('PDF_VALIDATION_POLICY_INVALID');
  return milliseconds;
}
