import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  type SourceNormalizationPolicy,
} from './profile';

export function capturedSourceNormalizationPolicy(
  profileId: string,
  configSha256: unknown,
): SourceNormalizationPolicy | undefined {
  const configuration = pdfImportConfiguration(
    profileId,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
    NATIVE_WORD_WRAP_POLICY,
  );
  return checksumBuffer(Buffer.from(JSON.stringify(configuration))) ===
    configSha256
    ? NATIVE_WORD_WRAP_POLICY
    : undefined;
}
