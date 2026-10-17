import type { RouteConfiguration, ProviderTask } from './types';
import { checksumBuffer } from '../../../shared/blob-utils';
import { PdfProviderError } from './errors';
export function requirePilotTask(
  config: RouteConfiguration,
  task: ProviderTask,
  requestSha256: string,
  taskSha256: string,
) {
  if (!config.pilotInventory) return;
  const op = config.pilotInventory.operations.find(
      (o) => o.sourceSha256 === task.sourceSha256,
    ),
    entry = op?.tasks.find((t) => t.taskId === task.taskId),
    images = task.messages.flatMap((m) =>
      typeof m.content === 'string'
        ? []
        : m.content.filter((p) => p.type === 'image_url'),
    );
  if (
    !entry ||
    entry.taskSha256 !== taskSha256 ||
    entry.requestSha256 !== requestSha256 ||
    images.length !== 1 ||
    images[0].type !== 'image_url'
  )
    throw new PdfProviderError('PDF_PROVIDER_PILOT_UNAUTHORIZED');
  const base64 = images[0].image_url.url.split(',')[1],
    bytes = Buffer.from(base64, 'base64');
  if (
    bytes.toString('base64') !== base64 ||
    checksumBuffer(bytes) !== entry.renderSha256
  )
    throw new PdfProviderError('PDF_PROVIDER_PILOT_UNAUTHORIZED');
}
