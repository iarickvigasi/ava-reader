import { PdfRuntimeError } from './runtime-error';
export type InitialExchangeInput = {
  schema_version:
    | 'ava-reconstruct-input-1'
    | 'ava-reconstruct-input-3'
    | 'ava-reconstruct-input-4'
    | 'ava-reconstruct-input-5'
    | 'ava-reconstruct-input-6'
    | 'ava-reconstruct-input-7'
    | 'ava-reconstruct-input-8';
  profile_id: string;
  source_sha256: string;
  source_feature_policy?: string;
  source_layout_policy?: string;
  source_structure_policy?: string;
  source_normalization_policy?: string;
  recognition_repair_policy?: string;
  source_title_policy?: string;
  geometry_corrections?: unknown[];
  responses: unknown[];
  native_structure_responses?: unknown[];
  word_wrap_responses?: unknown[];
  refinements: unknown[];
};

export function initialExchangeInput(value: unknown): InitialExchangeInput {
  const request = value as InitialExchangeInput | null;
  const layout = request?.schema_version === 'ava-reconstruct-input-3';
  const native2 = request?.schema_version === 'ava-reconstruct-input-8';
  const title =
    request?.schema_version === 'ava-reconstruct-input-7' || native2;
  const geometry =
    request?.schema_version === 'ava-reconstruct-input-6' || title;
  const wrap =
    request?.schema_version === 'ava-reconstruct-input-5' || geometry;
  const native = request?.schema_version === 'ava-reconstruct-input-4' || wrap;
  const allowed = [
    'schema_version',
    'profile_id',
    'source_sha256',
    'source_feature_policy',
    'responses',
    'refinements',
    ...(layout || native ? ['source_layout_policy'] : []),
    ...(wrap ? ['source_normalization_policy', 'word_wrap_responses'] : []),
    ...(geometry ? ['recognition_repair_policy', 'geometry_corrections'] : []),
    ...(title ? ['source_title_policy'] : []),
    ...(native
      ? ['source_structure_policy', 'native_structure_responses']
      : []),
  ];
  if (
    !request ||
    typeof request !== 'object' ||
    Array.isArray(request) ||
    Object.keys(request).some((key) => !allowed.includes(key)) ||
    (!layout &&
      !native &&
      request.schema_version !== 'ava-reconstruct-input-1') ||
    !['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'].includes(
      request.profile_id,
    ) ||
    typeof request.source_sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(request.source_sha256) ||
    (request.source_feature_policy !== undefined &&
      request.source_feature_policy !== 'ava-ocr-source-features-1') ||
    !Array.isArray(request.responses) ||
    request.responses.length ||
    !Array.isArray(request.refinements) ||
    request.refinements.length ||
    ((layout || native) &&
      (request.source_feature_policy !== 'ava-ocr-source-features-1' ||
        request.source_layout_policy !== 'ava-native-layout-1')) ||
    (native &&
      (request.source_structure_policy !==
        (native2 ? 'ava-native-structure-2' : 'ava-native-structure-1') ||
        !Array.isArray(request.native_structure_responses) ||
        request.native_structure_responses.length)) ||
    (wrap &&
      (request.source_normalization_policy !== 'ava-native-word-wrap-1' ||
        !Array.isArray(request.word_wrap_responses) ||
        request.word_wrap_responses.length)) ||
    (title && request.source_title_policy !== 'ava-frontmatter-title-1') ||
    (geometry &&
      (request.recognition_repair_policy !==
        'ava-recognition-geometry-repair-1' ||
        !Array.isArray(request.geometry_corrections) ||
        request.geometry_corrections.length))
  )
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  return request;
}
