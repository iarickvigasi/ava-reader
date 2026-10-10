import { validateSourceFeatures } from './source-report-features';
import { book, report } from './source-report-feature-fixture';

it('validates finite explicit regular style and codepoint range, keeping visual fidelity separate', () => {
  const r = report();
  expect(() => validateSourceFeatures(r, book, true)).not.toThrow();
  expect(r.checks.independent_visual_source_fidelity).toBe('not_run');
});
it('permits optional uninspected family as a source-bound unknown with no fabricated receipt', () => {
  const r = report(),
    l = r.source_feature_coverage!;
  Object.assign(l.evidence[0], {
    feature: 'family',
    disposition: 'unknown',
    value: null,
    reason: 'source_context_unavailable',
    task_id: null,
    task_sha256: null,
    response_sha256: null,
    crop_sha256: null,
    crop_ids: [],
  });
  l.inspected_features = 0;
  l.uninspected_features = 1;
  expect(() => validateSourceFeatures(r, book, true)).not.toThrow();
});
it.each([
  'missing',
  'duplicate',
  'source',
  'text',
  'style',
  'counts',
  'crop',
  'role',
  'fake',
  'page',
  'box',
  'range',
])('rejects %s incomplete/current-policy evidence', (change) => {
  const r = report(),
    l = r.source_feature_coverage!,
    e = l.evidence[0];
  if (change === 'missing') delete r.source_feature_coverage;
  if (change === 'duplicate') {
    l.evidence.push(e);
    l.requested_features = 2;
    l.inspected_features = 2;
  }
  if (change === 'source') e.source_sha256 = 'b'.repeat(64);
  if (change === 'text') e.text_length--;
  if (change === 'style') e.value = true;
  if (change === 'counts') l.inspected_features = 0;
  if (change === 'crop') e.crop_ids = [];
  if (change === 'role')
    Object.assign(e, {
      feature: 'paragraph_role',
      disposition: 'unknown',
      value: null,
      reason: 'source_blurred',
    });
  if (change === 'fake')
    Object.assign(e, {
      disposition: 'unknown',
      value: null,
      reason: 'comparison_budget_bound',
    });
  if (change === 'page') e.page = 500;
  if (change === 'box') e.box.x1 = 11;
  if (change === 'range') e.text_length++;
  expect(() => validateSourceFeatures(r, book, true)).toThrow(
    'PDF_SOURCE_REPORT_INVALID',
  );
});
it('retains historical evidence parsing but current policy cannot accept a historical report', () => {
  const r = report();
  r.schema_version = 'ava-reconstruction-report-1';
  delete r.source_feature_coverage;
  delete r.checks.finite_source_feature_dispositions_complete;
  expect(() => validateSourceFeatures(r, book, false)).not.toThrow();
  expect(() => validateSourceFeatures(r, book, true)).toThrow(
    'PDF_SOURCE_REPORT_INVALID',
  );
});
