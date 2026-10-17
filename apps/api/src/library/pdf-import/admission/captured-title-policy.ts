import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
  type SourceTitlePolicy,
} from './profile';

export function capturedSourceTitlePolicy(
  profileId: string,
  configSha256: unknown,
): SourceTitlePolicy | undefined {
  const configuration = pdfImportConfiguration(
    profileId,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_POLICY,
    NATIVE_WORD_WRAP_POLICY,
    RECOGNITION_GEOMETRY_REPAIR_POLICY,
    FRONTMATTER_TITLE_POLICY,
  );
  return checksumBuffer(Buffer.from(JSON.stringify(configuration))) ===
    configSha256
    ? FRONTMATTER_TITLE_POLICY
    : undefined;
}
