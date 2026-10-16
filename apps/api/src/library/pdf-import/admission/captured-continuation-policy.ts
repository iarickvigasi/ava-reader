import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
  SOURCE_CONTINUATION_POLICY,
} from './profile';

// Only the exact captured configuration grants the new presentation authority.
export function capturedSourceContinuationPolicy(
  profileId: string,
  configSha256: unknown,
) {
  const configuration = pdfImportConfiguration(
    profileId,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_V2_POLICY,
    NATIVE_WORD_WRAP_POLICY,
    RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
    FRONTMATTER_TITLE_POLICY,
    SOURCE_CONTINUATION_POLICY,
  );
  return checksumBuffer(Buffer.from(JSON.stringify(configuration))) ===
    configSha256
    ? SOURCE_CONTINUATION_POLICY
    : undefined;
}
