import { geometryTask, geometryAnswer } from './cell-geometry-fixture';
import { geometrySha } from './geometry-binding';
import { localCellGeometryResult } from './local-cell-geometry-result';

export const localPolicies = {
  sourceLayoutPolicy: 'ava-native-layout-1',
  sourceStructurePolicy: 'ava-native-structure-2',
  sourceNormalizationPolicy: 'ava-native-word-wrap-1',
  recognitionRepairPolicy: 'ava-recognition-geometry-repair-2',
  sourceTitlePolicy: 'ava-frontmatter-title-1',
  sourceContinuationPolicy: 'ava-source-continuation-presentation-1',
  localCellGeometryPolicy: 'ava-cell-exact-line-ocr-1',
} as const;

// Authored transport peer only; it is never evidence of a genuine OCR engine run.
export function localPacket(request: Buffer, proved = true) {
  const tsv = Buffer.from('authored local transport peer');
  const response = JSON.stringify(geometryAnswer);
  return localCellGeometryResult.parse({
    schema_version: 'ava-cell-geometry-localization-1',
    origin: 'LOCAL_OCR',
    method: localPolicies.localCellGeometryPolicy,
    request_sha256: geometrySha(request.toString()),
    task_id: geometryTask.task_id,
    source_sha256: geometryTask.source_sha256,
    render_sha256: geometryTask.render_sha256,
    original_response_sha256: geometryTask.original_response_sha256,
    languages:
      geometryTask.profile_id === 'ava-pdf-prose-en-uk-v3' ? 'eng+ukr' : 'eng',
    binary_sha256: 'b'.repeat(64),
    traineddata_sha256: ['c'.repeat(64)],
    tsv_base64: tsv.toString('base64'),
    tsv_byte_length: tsv.length,
    tsv_sha256: geometrySha(tsv.toString()),
    status: proved ? 'PROVED' : 'NO_PROOF',
    reason: proved ? null : 'NO_UNIQUE_SOURCE_LINE',
    response_json: proved ? response : null,
    response_sha256: proved ? geometrySha(response) : null,
  });
}
export function localPeer(proved = true) {
  const packet = localPacket(Buffer.from('authored-request'), proved);
  return { ...packet, proofSha256: geometrySha(JSON.stringify(packet)) };
}
