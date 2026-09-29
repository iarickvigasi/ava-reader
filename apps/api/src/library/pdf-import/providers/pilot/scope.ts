import { PdfProviderError } from '../errors';
export const PILOT_IMAGE =
  '725dc4c5fee1d7addf289484d7def37d8d8aff43dceba16bfd18d0d8f1cb66d3';
export const PILOT_SOURCES = [
  'e651d6255b5b8ba8000c3ca195a17f1521b60764ac922b64eb05ac784fed6b18',
];
export const PILOT_REQUESTS = 2;
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
