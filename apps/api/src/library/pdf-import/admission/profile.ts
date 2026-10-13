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
export const NATIVE_LAYOUT_POLICY = 'ava-native-layout-1' as const;
export type NativeLayoutPolicy = typeof NATIVE_LAYOUT_POLICY;
const LAYOUT_LEGACY = Object.freeze({
  ...PDF_IMPORT_PROFILE,
  sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
});
const LAYOUT_V3 = Object.freeze({
  ...PDF_IMPORT_PROFILE_V3,
  sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
});
export type PdfImportConfiguration =
  | typeof PDF_IMPORT_PROFILE
  | typeof PDF_IMPORT_PROFILE_V3
  | typeof LAYOUT_LEGACY
  | typeof LAYOUT_V3;
export function pdfImportConfiguration(
  profileId?: string,
  sourceLayoutPolicy?: unknown,
): PdfImportConfiguration {
  const legacy = !profileId || profileId === PDF_IMPORT_PROFILE.profileId;
  if (!legacy && profileId !== PDF_IMPORT_PROFILE_V3.profileId)
    throw new Error('PDF_IMPORT_PROFILE_INVALID');
  if (sourceLayoutPolicy === undefined || sourceLayoutPolicy === '')
    return legacy ? PDF_IMPORT_PROFILE : PDF_IMPORT_PROFILE_V3;
  if (sourceLayoutPolicy !== NATIVE_LAYOUT_POLICY)
    throw new Error('PDF_IMPORT_PROFILE_INVALID');
  return legacy ? LAYOUT_LEGACY : LAYOUT_V3;
}

// Execution follows captured configuration identity, never the current selector.
export function capturedSourceLayoutPolicy(
  profileId: string,
  configSha256: unknown,
): NativeLayoutPolicy | undefined {
  const current = pdfImportConfiguration(profileId, NATIVE_LAYOUT_POLICY);
  return checksumBuffer(Buffer.from(JSON.stringify(current))) === configSha256
    ? NATIVE_LAYOUT_POLICY
    : undefined;
}
