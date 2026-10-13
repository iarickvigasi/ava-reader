import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
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
  return checksumBuffer(Buffer.from(JSON.stringify(configuration))) ===
    configSha256
    ? NATIVE_STRUCTURE_POLICY
    : undefined;
}
