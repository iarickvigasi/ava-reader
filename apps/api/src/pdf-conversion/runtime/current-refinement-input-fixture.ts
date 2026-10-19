import { checksumBuffer } from '../../shared/blob-utils';
import {
  pdfImportConfiguration,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_V2_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  FRONTMATTER_TITLE_POLICY,
  RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
  SOURCE_CONTINUATION_POLICY,
} from '../../library/pdf-import/admission/profile';
import { capturedSourcePolicies } from '../../library/pdf-import/admission/captured-source-policies';
import { reconstructionRequest } from '../reconstruction/reconstruction-request';
import { continuationTask } from '../reconstruction/continuation-fixture';
import { exchangeInput, encode } from './exchange-test-fixture';

export function currentRefinementInput(current = true) {
  const configuration = pdfImportConfiguration(
    continuationTask.profile_id,
    NATIVE_LAYOUT_POLICY,
    NATIVE_STRUCTURE_V2_POLICY,
    NATIVE_WORD_WRAP_POLICY,
    RECOGNITION_CELL_GEOMETRY_REPAIR_POLICY,
    FRONTMATTER_TITLE_POLICY,
    current ? SOURCE_CONTINUATION_POLICY : undefined,
  );
  const hash = checksumBuffer(encode(configuration));
  const identity = {
    sourceSha256: continuationTask.source_sha256,
    profileId: continuationTask.profile_id,
    ...capturedSourcePolicies(continuationTask.profile_id, hash),
  };
  return {
    ...exchangeInput(),
    jobBytes: encode({
      source: { sha256: identity.sourceSha256 },
      profile_id: identity.profileId,
      config_sha256: hash,
    }),
    auxiliaryBytes: encode({
      mode: 'attempt_stream',
      input: reconstructionRequest(identity),
    }),
  };
}
