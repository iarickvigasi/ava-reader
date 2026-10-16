import { SOURCE_CONTINUATION_POLICY } from './source-continuation-policy';
import { FRONTMATTER_TITLE_POLICY } from './frontmatter-title-policy';
import {
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
} from './recognition-geometry-policy';
import { NATIVE_WORD_WRAP_POLICY } from './native-word-wrap-policy';
import { PDF_IMPORT_PROFILE, PDF_IMPORT_PROFILE_V3 } from './base-profile';
export {
  PDF_IMPORT_PROFILE,
  PDF_IMPORT_PROFILE_V3,
  PDF_CONFIG_HASH,
} from './base-profile';

export const NATIVE_LAYOUT_POLICY = 'ava-native-layout-1' as const;
export type NativeLayoutPolicy = typeof NATIVE_LAYOUT_POLICY;
export const NATIVE_STRUCTURE_POLICY = 'ava-native-structure-1' as const;
export const NATIVE_STRUCTURE_V2_POLICY = 'ava-native-structure-2' as const;
export type NativeStructurePolicy =
  | typeof NATIVE_STRUCTURE_POLICY
  | typeof NATIVE_STRUCTURE_V2_POLICY;
const LAYOUT_LEGACY = Object.freeze({
  ...PDF_IMPORT_PROFILE,
  sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
});
const LAYOUT_V3 = Object.freeze({
  ...PDF_IMPORT_PROFILE_V3,
  sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
});
const STRUCTURE_LEGACY = Object.freeze({
  ...LAYOUT_LEGACY,
  sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
});
const STRUCTURE_V3 = Object.freeze({
  ...LAYOUT_V3,
  sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
});
const NORMALIZATION_LEGACY = Object.freeze({
  ...STRUCTURE_LEGACY,
  sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
});
const NORMALIZATION_V3 = Object.freeze({
  ...STRUCTURE_V3,
  sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
});
const GEOMETRY_LEGACY = Object.freeze({
  ...NORMALIZATION_LEGACY,
  recognitionRepairPolicy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
});
const GEOMETRY_V3 = Object.freeze({
  ...NORMALIZATION_V3,
  recognitionRepairPolicy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
});
const TITLE_LEGACY = Object.freeze({
  ...GEOMETRY_LEGACY,
  sourceTitlePolicy: FRONTMATTER_TITLE_POLICY,
});
const TITLE_V3 = Object.freeze({
  ...GEOMETRY_V3,
  sourceTitlePolicy: FRONTMATTER_TITLE_POLICY,
});
const STRUCTURE_V2_LEGACY = Object.freeze({
  ...TITLE_LEGACY,
  sourceStructurePolicy: NATIVE_STRUCTURE_V2_POLICY,
});
const STRUCTURE_V2_V3 = Object.freeze({
  ...TITLE_V3,
  sourceStructurePolicy: NATIVE_STRUCTURE_V2_POLICY,
});
const CELL_GEOMETRY_LEGACY = Object.freeze({
  ...STRUCTURE_V2_LEGACY,
  recognitionRepairPolicy: RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
});
const CELL_GEOMETRY_V3 = Object.freeze({
  ...STRUCTURE_V2_V3,
  recognitionRepairPolicy: RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
});
const CONTINUATION_LEGACY = Object.freeze({
  ...CELL_GEOMETRY_LEGACY,
  sourceContinuationPolicy: SOURCE_CONTINUATION_POLICY,
});
const CONTINUATION_V3 = Object.freeze({
  ...CELL_GEOMETRY_V3,
  sourceContinuationPolicy: SOURCE_CONTINUATION_POLICY,
});
export type PdfImportConfiguration =
  | typeof CONTINUATION_LEGACY
  | typeof CONTINUATION_V3
  | typeof PDF_IMPORT_PROFILE
  | typeof PDF_IMPORT_PROFILE_V3
  | typeof LAYOUT_LEGACY
  | typeof LAYOUT_V3
  | typeof STRUCTURE_LEGACY
  | typeof STRUCTURE_V3
  | typeof NORMALIZATION_LEGACY
  | typeof NORMALIZATION_V3
  | typeof GEOMETRY_LEGACY
  | typeof GEOMETRY_V3
  | typeof TITLE_LEGACY
  | typeof TITLE_V3
  | typeof STRUCTURE_V2_LEGACY
  | typeof STRUCTURE_V2_V3
  | typeof CELL_GEOMETRY_LEGACY
  | typeof CELL_GEOMETRY_V3;
export function pdfImportConfiguration(
  profileId?: string,
  sourceLayoutPolicy?: unknown,
  sourceStructurePolicy?: unknown,
  sourceNormalizationPolicy?: unknown,
  recognitionRepairPolicy?: unknown,
  sourceTitlePolicy?: unknown,
  sourceContinuationPolicy?: unknown,
): PdfImportConfiguration {
  const legacy = !profileId || profileId === PDF_IMPORT_PROFILE.profileId;
  if (!legacy && profileId !== PDF_IMPORT_PROFILE_V3.profileId)
    throw new Error('PDF_IMPORT_PROFILE_INVALID');
  if (
    sourceContinuationPolicy !== undefined &&
    sourceContinuationPolicy !== ''
  ) {
    if (
      sourceContinuationPolicy !== SOURCE_CONTINUATION_POLICY ||
      sourceLayoutPolicy !== NATIVE_LAYOUT_POLICY ||
      sourceStructurePolicy !== NATIVE_STRUCTURE_V2_POLICY ||
      sourceNormalizationPolicy !== NATIVE_WORD_WRAP_POLICY ||
      recognitionRepairPolicy !== RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY ||
      sourceTitlePolicy !== FRONTMATTER_TITLE_POLICY
    )
      throw new Error('PDF_IMPORT_PROFILE_INVALID');
    return legacy ? CONTINUATION_LEGACY : CONTINUATION_V3;
  }
  if (sourceStructurePolicy === NATIVE_STRUCTURE_V2_POLICY) {
    if (
      sourceLayoutPolicy !== NATIVE_LAYOUT_POLICY ||
      sourceNormalizationPolicy !== NATIVE_WORD_WRAP_POLICY ||
      (recognitionRepairPolicy !== RECOGNITION_GEOMETRY_REPAIR_POLICY &&
        recognitionRepairPolicy !== RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY) ||
      sourceTitlePolicy !== FRONTMATTER_TITLE_POLICY
    )
      throw new Error('PDF_IMPORT_PROFILE_INVALID');
    if (recognitionRepairPolicy === RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY)
      return legacy ? CELL_GEOMETRY_LEGACY : CELL_GEOMETRY_V3;
    return legacy ? STRUCTURE_V2_LEGACY : STRUCTURE_V2_V3;
  }
  if (sourceTitlePolicy !== undefined && sourceTitlePolicy !== '') {
    if (
      sourceTitlePolicy !== FRONTMATTER_TITLE_POLICY ||
      recognitionRepairPolicy !== RECOGNITION_GEOMETRY_REPAIR_POLICY ||
      sourceNormalizationPolicy !== NATIVE_WORD_WRAP_POLICY ||
      sourceStructurePolicy !== NATIVE_STRUCTURE_POLICY ||
      sourceLayoutPolicy !== NATIVE_LAYOUT_POLICY
    )
      throw new Error('PDF_IMPORT_PROFILE_INVALID');
    return legacy ? TITLE_LEGACY : TITLE_V3;
  }
  if (recognitionRepairPolicy !== undefined && recognitionRepairPolicy !== '') {
    if (
      recognitionRepairPolicy !== RECOGNITION_GEOMETRY_REPAIR_POLICY ||
      sourceNormalizationPolicy !== NATIVE_WORD_WRAP_POLICY ||
      sourceStructurePolicy !== NATIVE_STRUCTURE_POLICY ||
      sourceLayoutPolicy !== NATIVE_LAYOUT_POLICY
    )
      throw new Error('PDF_IMPORT_PROFILE_INVALID');
    return legacy ? GEOMETRY_LEGACY : GEOMETRY_V3;
  }
  if (
    sourceNormalizationPolicy !== undefined &&
    sourceNormalizationPolicy !== ''
  ) {
    if (
      sourceNormalizationPolicy !== NATIVE_WORD_WRAP_POLICY ||
      sourceStructurePolicy !== NATIVE_STRUCTURE_POLICY ||
      sourceLayoutPolicy !== NATIVE_LAYOUT_POLICY
    )
      throw new Error('PDF_IMPORT_PROFILE_INVALID');
    return legacy ? NORMALIZATION_LEGACY : NORMALIZATION_V3;
  }
  if (sourceStructurePolicy !== undefined && sourceStructurePolicy !== '') {
    if (
      sourceStructurePolicy !== NATIVE_STRUCTURE_POLICY ||
      sourceLayoutPolicy !== NATIVE_LAYOUT_POLICY
    )
      throw new Error('PDF_IMPORT_PROFILE_INVALID');
    return legacy ? STRUCTURE_LEGACY : STRUCTURE_V3;
  }
  if (sourceLayoutPolicy === undefined || sourceLayoutPolicy === '')
    return legacy ? PDF_IMPORT_PROFILE : PDF_IMPORT_PROFILE_V3;
  if (sourceLayoutPolicy !== NATIVE_LAYOUT_POLICY)
    throw new Error('PDF_IMPORT_PROFILE_INVALID');
  return legacy ? LAYOUT_LEGACY : LAYOUT_V3;
}

export { capturedSourceLayoutPolicy } from './captured-layout-policy';
export { capturedSourceStructurePolicy } from './captured-structure-policy';
export { capturedSourceNormalizationPolicy } from './captured-normalization-policy';
export {
  NATIVE_WORD_WRAP_POLICY,
  type SourceNormalizationPolicy,
} from './native-word-wrap-policy';

export { capturedRecognitionRepairPolicy } from './captured-recognition-repair-policy';
export {
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
  type RecognitionRepairPolicy,
} from './recognition-geometry-policy';

export { capturedSourceTitlePolicy } from './captured-title-policy';
export {
  FRONTMATTER_TITLE_POLICY,
  type SourceTitlePolicy,
} from './frontmatter-title-policy';

export { capturedNativeStructureV2Policy } from './captured-native-structure-v2-policy';

export {
  SOURCE_CONTINUATION_POLICY,
  type SourceContinuationPolicy,
} from './source-continuation-policy';
