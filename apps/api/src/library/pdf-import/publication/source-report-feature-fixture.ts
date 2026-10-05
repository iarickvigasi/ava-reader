import { createHash } from 'node:crypto';
import type {
  ReconstructionReport,
  SourceFeatureEvidence,
} from '../../../pdf-conversion/reconstruction/generated/ReconstructionReport';
import type { CanonicalBookV2 } from '../../../pdf-conversion/contracts/generated/ava-book-2';
const hash = 'a'.repeat(64),
  text = 'A source appearance.😀';
const sourceBox = {
  coordinate_space: 'page_points_top_left',
  x0: 0,
  y0: 0,
  x1: 10,
  y1: 10,
} as const;
export const book = {
  source: { sha256: hash },
  pages: [{ number: 1, width_pt: 100, height_pt: 100 }],
  blocks: [
    {
      id: 'appearance',
      evidence: [
        { page: 1, box: sourceBox, method: 'ocr', region_id: 'region' },
      ],
      kind: 'quote',
      style_id: 'source-style',
      content: { text },
    },
  ],
  styles: [{ id: 'source-style', bold: false, family: 'sans-serif' }],
} as unknown as CanonicalBookV2;
export function report(): ReconstructionReport {
  const evidence: SourceFeatureEvidence = {
    node_id: 'source-node',
    canonical_block_id: 'appearance',
    canonical_start: 0,
    text_length: [...text].length,
    text_sha256: createHash('sha256').update(text).digest('hex'),
    page: 1,
    box: {
      coordinate_space: 'page_points_top_left',
      x0: 0,
      y0: 0,
      x1: 10,
      y1: 10,
    },
    source_sha256: hash,
    observation_sha256: hash,
    task_id: 'task',
    task_sha256: hash,
    response_sha256: hash,
    crop_sha256: hash,
    crop_ids: ['target-crop', 'reference-crop'],
    feature: 'weight',
    disposition: 'observed',
    value: false,
    reason: null,
  };
  return {
    schema_version: 'ava-reconstruction-report-2',
    source_sha256: hash,
    canonical_sha256: hash,
    epub_sha256: hash,
    resource_hashes: {},
    profile_id: 'ava-pdf-prose-en-v2',
    outcome: 'candidate',
    page_count: 1,
    recognition_task_count: 1,
    checks: {
      finite_source_feature_dispositions_complete: 'pass',
      independent_visual_source_fidelity: 'not_run',
    },
    findings: [],
    source_feature_coverage: {
      policy_id: 'ava-ocr-source-features-1',
      requested_features: 1,
      inspected_features: 1,
      uninspected_features: 0,
      unrequested_optional_candidates: 0,
      evidence: [evidence],
    },
  };
}
