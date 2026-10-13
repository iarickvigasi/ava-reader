import type { NativeLayoutPolicy } from '../../library/pdf-import/admission/profile';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RefinementResponse } from './refinement-packets';

export function reconstructionRequest(
  identity: {
    profileId: string;
    sourceSha256: string;
    sourceLayoutPolicy?: NativeLayoutPolicy;
  },
  responses: RecognitionResponse[] = [],
  refinements: RefinementResponse[] = [],
  titleScheduled = false,
) {
  return {
    schema_version: identity.sourceLayoutPolicy
      ? 'ava-reconstruct-input-3'
      : titleScheduled
        ? 'ava-reconstruct-input-2'
        : 'ava-reconstruct-input-1',
    ...(identity.sourceLayoutPolicy
      ? { source_layout_policy: identity.sourceLayoutPolicy }
      : {}),
    source_feature_policy: 'ava-ocr-source-features-1',
    profile_id: identity.profileId,
    source_sha256: identity.sourceSha256,
    responses,
    refinements,
  };
}
