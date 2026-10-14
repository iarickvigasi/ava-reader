import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
} from './profile';

export function capturedNativeStructureV2Policy(
  profileId: string,
  configSha256: unknown,
): typeof NATIVE_STRUCTURE_V2_POLICY | undefined {
  const configuration = pdfImportConfiguration(
    profileId,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_V2_POLICY,
    NATIVE_WORD_WRAP_POLICY,
    RECOGNITION_GEOMETRY_REPAIR_POLICY,
    FRONTMATTER_TITLE_POLICY,
  );
  return checksumBuffer(Buffer.from(JSON.stringify(configuration))) ===
    configSha256
    ? NATIVE_STRUCTURE_V2_POLICY
    : undefined;
}
