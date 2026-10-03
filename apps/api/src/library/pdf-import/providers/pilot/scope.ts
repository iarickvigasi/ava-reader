import { PdfProviderError } from '../errors';
export const PILOT_IMAGE =
  '0cf576ebc50f7be1a11c60ee25b51b46df526dd9b61e128ef7e5446200845193';
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
