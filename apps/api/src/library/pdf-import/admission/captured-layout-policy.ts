import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  type NativeLayoutPolicy,
} from './profile';

export function capturedSourceLayoutPolicy(
  profileId: string,
  configSha256: unknown,
): NativeLayoutPolicy | undefined {
  return [
    pdfImportConfiguration(profileId, NATIVE_LAYOUT_POLICY),
    pdfImportConfiguration(
      profileId,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_POLICY,
    ),
    pdfImportConfiguration(
      profileId,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_POLICY,
      NATIVE_WORD_WRAP_POLICY,
    ),
  ].some(
    (configuration) =>
      checksumBuffer(Buffer.from(JSON.stringify(configuration))) ===
      configSha256,
  )
    ? NATIVE_LAYOUT_POLICY
    : undefined;
}
