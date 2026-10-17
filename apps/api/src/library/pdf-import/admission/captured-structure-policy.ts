import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  type NativeStructurePolicy,
} from './profile';

export function capturedSourceStructurePolicy(
  profileId: string,
  configSha256: unknown,
): NativeStructurePolicy | undefined {
  const configuration = pdfImportConfiguration(
    profileId,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
  );
  const normalization = pdfImportConfiguration(
    profileId,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
    NATIVE_WORD_WRAP_POLICY,
  );
  return [configuration, normalization].some(
    (value) =>
      checksumBuffer(Buffer.from(JSON.stringify(value))) === configSha256,
  )
    ? NATIVE_STRUCTURE_POLICY
    : undefined;
}
