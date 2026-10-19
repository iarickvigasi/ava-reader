import { EpubSourceFindingError, sourceFindingSchema } from './source-finding';

const PREFIX = 'AVA_EPUB_SOURCE_FINDING:';
const GENERIC = 'This EPUB contains a structure AVA cannot preserve.';
export function readerProcessingFailure(error: unknown): string {
  if (error instanceof EpubSourceFindingError) {
    const finding = sourceFindingSchema.parse(error.finding);
    if (!finding.source.resourcePath)
      throw new Error('The EPUB finding has no source resource.');
    const message = PREFIX + JSON.stringify(finding);
    if (Buffer.byteLength(message) > 16 * 1024)
      throw new Error('The EPUB finding exceeds its bound.');
    return message;
  }
  return error instanceof Error
    ? error.message
    : 'Failed to process the EPUB for the reader.';
}
export function readerFailureMessage(
  stored: string | null | undefined,
): string {
  if (stored?.startsWith(PREFIX)) return GENERIC;
  return stored ?? 'The EPUB could not be prepared for the reader.';
}
