import type {
  NativeLayoutPolicy,
  NativeStructurePolicy,
} from '../../library/pdf-import/admission/profile';
import type { NativeStructureResponse } from './generated/NativeStructureResponse';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RefinementResponse } from './refinement-packets';

export function reconstructionRequest(
  identity: {
    profileId: string;
    sourceSha256: string;
    sourceLayoutPolicy?: NativeLayoutPolicy;
    sourceStructurePolicy?: NativeStructurePolicy;
  },
  responses: RecognitionResponse[] = [],
  refinements: RefinementResponse[] = [],
  titleScheduled = false,
  nativeStructureResponses: NativeStructureResponse[] = [],
) {
  return {
    schema_version: identity.sourceStructurePolicy
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
    source_feature_policy: 'ava-ocr-source-features-1',
    profile_id: identity.profileId,
    source_sha256: identity.sourceSha256,
    responses,
    refinements,
  };
}
