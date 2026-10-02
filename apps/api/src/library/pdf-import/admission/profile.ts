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

// New profiles are selected by the server only for new imports. The legacy configuration
// and checksum remain exact; persisted operations always execute their captured profile.
export const PDF_IMPORT_PROFILE_V3 = Object.freeze({
  ...PDF_IMPORT_PROFILE,
  profileId: 'ava-pdf-prose-en-uk-v3',
  schemaVersion: 3,
});
export type PdfImportConfiguration =
  | typeof PDF_IMPORT_PROFILE
  | typeof PDF_IMPORT_PROFILE_V3;
export function pdfImportConfiguration(
  profileId?: string,
): PdfImportConfiguration {
  if (!profileId || profileId === PDF_IMPORT_PROFILE.profileId)
    return PDF_IMPORT_PROFILE;
  if (profileId === PDF_IMPORT_PROFILE_V3.profileId)
    return PDF_IMPORT_PROFILE_V3;
  throw new Error('PDF_IMPORT_PROFILE_INVALID');
}
