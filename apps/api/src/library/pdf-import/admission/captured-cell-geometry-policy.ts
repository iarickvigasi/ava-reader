import { checksumBuffer } from '../../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
} from './profile';

/** Exact immutable capture; older policy hashes never acquire cell authority. */
export function capturedCellGeometryPolicy(
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
  );
  return checksumBuffer(Buffer.from(JSON.stringify(configuration))) ===
    configSha256
    ? RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY
    : undefined;
}
