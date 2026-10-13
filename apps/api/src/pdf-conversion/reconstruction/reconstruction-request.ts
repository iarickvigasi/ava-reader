import type {
  NativeLayoutPolicy,
  NativeStructurePolicy,
  SourceNormalizationPolicy,
  RecognitionRepairPolicy,
  SourceTitlePolicy,
} from '../../library/pdf-import/admission/profile';
import type { RecognitionGeometryProof } from './generated/RecognitionGeometryProof';
import type { WordWrapResponse } from './generated/WordWrapResponse';
import type { NativeStructureResponse } from './generated/NativeStructureResponse';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RefinementResponse } from './refinement-packets';

export function reconstructionRequest(
  identity: {
    profileId: string;
    sourceSha256: string;
    sourceLayoutPolicy?: NativeLayoutPolicy;
    sourceStructurePolicy?: NativeStructurePolicy;
    sourceNormalizationPolicy?: SourceNormalizationPolicy;
    recognitionRepairPolicy?: RecognitionRepairPolicy;
    sourceTitlePolicy?: SourceTitlePolicy;
  },
  responses: RecognitionResponse[] = [],
  refinements: RefinementResponse[] = [],
  titleScheduled = false,
  nativeStructureResponses: NativeStructureResponse[] = [],
  wordWrapResponses: WordWrapResponse[] = [],
  geometryCorrections: RecognitionGeometryProof[] = [],
) {
  return {
    schema_version: identity.sourceTitlePolicy
      ? 'ava-reconstruct-input-7'
      : identity.recognitionRepairPolicy
        ? 'ava-reconstruct-input-6'
        : identity.sourceNormalizationPolicy
          ? 'ava-reconstruct-input-5'
          : identity.sourceStructurePolicy
            ? 'ava-reconstruct-input-4'
            : identity.sourceLayoutPolicy
              ? 'ava-reconstruct-input-3'
              : titleScheduled
                ? 'ava-reconstruct-input-2'
                : 'ava-reconstruct-input-1',
    ...(identity.sourceLayoutPolicy
      ? {
          source_layout_policy: identity.sourceLayoutPolicy,
          ...(identity.sourceStructurePolicy
            ? {
                source_structure_policy: identity.sourceStructurePolicy,
                native_structure_responses: nativeStructureResponses,
              }
            : {}),
        }
      : {}),
    ...(identity.sourceNormalizationPolicy
      ? {
          source_normalization_policy: identity.sourceNormalizationPolicy,
          word_wrap_responses: wordWrapResponses,
        }
      : {}),
    ...(identity.recognitionRepairPolicy
      ? {
          recognition_repair_policy: identity.recognitionRepairPolicy,
          geometry_corrections: geometryCorrections,
        }
      : {}),
    ...(identity.sourceTitlePolicy
      ? { source_title_policy: identity.sourceTitlePolicy }
      : {}),
    source_feature_policy: 'ava-ocr-source-features-1',
    profile_id: identity.profileId,
    source_sha256: identity.sourceSha256,
    responses,
    refinements,
  };
}
