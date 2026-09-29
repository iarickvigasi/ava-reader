import { checksumBuffer } from '../../../shared/blob-utils';

export const PDF_IMPORT_PROFILE = Object.freeze({
  profileId: 'ava-pdf-prose-en-v2',
  schemaVersion: 1,
  maxSourceBytes: 50 * 1024 * 1024,
  maxPages: 500,
  maxRasterPixels: 20_000_000,
  maxRasterEdge: 6000,
  inspectionTimeoutMs: 30_000,
  stagingTtlMs: 60 * 60 * 1000,
});
export const PDF_CONFIG_HASH = checksumBuffer(
  Buffer.from(JSON.stringify(PDF_IMPORT_PROFILE)),
);
