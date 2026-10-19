import {
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
  SOURCE_CONTINUATION_POLICY,
} from '../../library/pdf-import/admission/profile';

export const HISTORICAL_REFINEMENT_TASK_LIMIT = 32;
export const CURRENT_REFINEMENT_TASK_LIMIT = 64;

export const MAX_CURRENT_REFINEMENT_PAYLOAD = 64 * 1024 ** 2;
export const MAX_CURRENT_REFINEMENT_FRAME =
  MAX_CURRENT_REFINEMENT_PAYLOAD + 1024;
export function currentRefinementPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return false;
  const value = payload as Record<string, unknown>;
  return (
    value.schema_version === 'ava-book-refinement-batch-4' &&
    value.source_continuation_policy ===
      'ava-source-continuation-presentation-1'
  );
}

export function currentRefinementMode(context: {
  sourceLayoutPolicy?: string;
  sourceStructurePolicy?: string;
  sourceNormalizationPolicy?: string;
  recognitionRepairPolicy?: string;
  sourceTitlePolicy?: string;
  sourceContinuationPolicy?: string;
}): boolean {
  return (
    context.sourceLayoutPolicy === NATIVE_LAYOUT_POLICY &&
    context.sourceStructurePolicy === NATIVE_STRUCTURE_V2_POLICY &&
    context.sourceNormalizationPolicy === NATIVE_WORD_WRAP_POLICY &&
    context.recognitionRepairPolicy ===
      RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY &&
    context.sourceTitlePolicy === FRONTMATTER_TITLE_POLICY &&
    context.sourceContinuationPolicy === SOURCE_CONTINUATION_POLICY
  );
}
