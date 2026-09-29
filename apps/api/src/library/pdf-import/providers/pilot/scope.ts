import { PdfProviderError } from '../errors';
export const PILOT_IMAGE =
  '83f95aa2d512e1ee72eaf8a94f2338065c29071891627a8016a40eb917c41813';
export const PILOT_SOURCES = [
  'ead57e233d0159460a7a8b63b15fe8ad8c9888be7a1989885a9536696c2d363b',
];
// Diagnostic authored-fixture path only; never called by public API/background loops.
export function requirePilotOperator(env: NodeJS.ProcessEnv = process.env) {
  let database: URL;
  try {
    database = new URL(env.DATABASE_URL ?? '');
  } catch {
    throw new PdfProviderError('PDF_PILOT_DISABLED');
  }
  if (
    env.NODE_ENV !== 'test' ||
    env.AVA_PDF_TEST_HOOKS !== '1' ||
    env.AVA_PDF_AUTHORED_PILOT !== '1' ||
    database.hostname !== '127.0.0.1' ||
    database.pathname !== '/ava_pdf_authored_pilot'
  )
    throw new PdfProviderError('PDF_PILOT_DISABLED');
}
