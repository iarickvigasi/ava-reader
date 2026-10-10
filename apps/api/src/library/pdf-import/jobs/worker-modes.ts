import type { PdfWorkerMode } from './register-worker';
import { PdfJobError } from './errors';
export function configuredWorkerModes(
  value = process.env.AVA_PDF_WORKER_MODES,
): PdfWorkerMode[] {
  if (value === undefined) return ['native'];
  const modes = value.split(',');
  if (
    !modes.length ||
    modes.length > 4 ||
    new Set(modes).size !== modes.length ||
    modes.some((mode) => !['native', 'stub', 'replay', 'live'].includes(mode))
  )
    throw new PdfJobError('PDF_WORKER_REGISTRATION_INVALID');
  return modes as PdfWorkerMode[];
}
