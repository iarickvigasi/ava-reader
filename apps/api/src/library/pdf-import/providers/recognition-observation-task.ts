import { providerTask } from '../../../pdf-conversion/reconstruction/provider-task';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jsonHash } from './hash';
import { PdfProviderError } from './errors';
import type { ProviderTask } from './types';
// Recover only the trusted, exact factory-produced context, never provider output.
export function recognitionObservationTask(task: ProviderTask) {
  try {
    const content = task.messages[1]?.content;
    if (
      task.pageIndices.length !== 1 ||
      typeof content === 'string' ||
      content?.length !== 2 ||
      content[0].type !== 'text' ||
      content[1].type !== 'image_url'
    )
      throw new Error();
    const context = JSON.parse(content[0].text) as Record<string, unknown>;
    const { render_sha256: render, image, ...fields } = context;
    const match =
      /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        content[1].image_url.url,
      );
    if (!match) throw new Error();
    const pixels = Buffer.from(match[2], 'base64');
    if (
      pixels.toString('base64') !== match[2] ||
      render !== checksumBuffer(pixels)
    )
      throw new Error();
    const recovered = validatePacket('RecognitionTask', {
      ...fields,
      image: {
        ...(image as object),
        media_type: match[1],
        sha256: checksumBuffer(pixels),
        byte_length: pixels.length,
        base64: match[2],
      },
    });
    const roundTrip = providerTask(
      recovered,
      task.sourceSha256,
      task.pageIndices[0] + 1,
    );
    if (task.maxOutputTokens !== undefined)
      roundTrip.maxOutputTokens = task.maxOutputTokens;
    if (jsonHash(roundTrip) !== jsonHash(task)) throw new Error();
    return recovered;
  } catch {
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  }
}
