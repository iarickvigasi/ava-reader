import { capturedCellOcrPolicy } from './captured-cell-ocr-policy';
import { capturedSourceContinuationPolicy } from './captured-continuation-policy';
import { RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY } from './profile';
import { capturedCellGeometryPolicy } from './captured-cell-geometry-policy';
import {
  capturedSourceLayoutPolicy,
  capturedSourceStructurePolicy,
  capturedSourceNormalizationPolicy,
  capturedRecognitionRepairPolicy,
  capturedSourceTitlePolicy,
  capturedNativeStructureV2Policy,
  FRONTMATTER_TITLE_POLICY,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
} from './profile';

export function capturedSourcePolicies(
  profileId: string,
  configSha256: unknown,
) {
  const localCellGeometryPolicy = capturedCellOcrPolicy(
    profileId,
    configSha256,
  );
  if (localCellGeometryPolicy)
    return {
      sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
      sourceStructurePolicy: NATIVE_STRUCTURE_V2_POLICY,
      sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
      recognitionRepairPolicy: RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
      sourceTitlePolicy: FRONTMATTER_TITLE_POLICY,
      sourceContinuationPolicy:
        'ava-source-continuation-presentation-1' as const,
      localCellGeometryPolicy,
    };
  const sourceContinuationPolicy = capturedSourceContinuationPolicy(
    profileId,
    configSha256,
  );
  if (sourceContinuationPolicy)
    return {
      sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
      sourceStructurePolicy: NATIVE_STRUCTURE_V2_POLICY,
      sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
      recognitionRepairPolicy: RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
      sourceTitlePolicy: FRONTMATTER_TITLE_POLICY,
      sourceContinuationPolicy,
    };
  const cell = capturedCellGeometryPolicy(profileId, configSha256);
  if (cell)
    return {
      sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
      sourceStructurePolicy: NATIVE_STRUCTURE_V2_POLICY,
      sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
      recognitionRepairPolicy: cell,
      sourceTitlePolicy: FRONTMATTER_TITLE_POLICY,
    };
  const native2 = capturedNativeStructureV2Policy(profileId, configSha256);
  if (native2)
    return {
      sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
      sourceStructurePolicy: native2,
      sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
      recognitionRepairPolicy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
      sourceTitlePolicy: FRONTMATTER_TITLE_POLICY,
    };
  const sourceTitlePolicy = capturedSourceTitlePolicy(profileId, configSha256);
  if (sourceTitlePolicy)
    return {
      sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
      sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
      sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
      recognitionRepairPolicy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
      sourceTitlePolicy,
    };
  const recognitionRepairPolicy = capturedRecognitionRepairPolicy(
    profileId,
    configSha256,
  );
  if (recognitionRepairPolicy)
    return {
      sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
      sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
      sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
      recognitionRepairPolicy,
    };
  return {
    sourceLayoutPolicy: capturedSourceLayoutPolicy(profileId, configSha256),
    sourceStructurePolicy: capturedSourceStructurePolicy(
      profileId,
      configSha256,
    ),
    sourceNormalizationPolicy: capturedSourceNormalizationPolicy(
      profileId,
      configSha256,
    ),
  };
}
