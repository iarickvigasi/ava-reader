import { parseSourceReport } from './source-report';
import type { CanonicalBookV2 } from '../../../pdf-conversion/contracts/generated/ava-book-2';
const hash = 'a'.repeat(64);
const checks = [
  'complete_source_pages',
  'complete_recognition_task_receipts',
  'native_character_conservation',
  'canonical_semantic_graph',
  'source_region_coverage',
  'note_list_table_relationships',
  'required_resource_byte_hashes',
  'declared_ocr_uncertainty_resolved',
  'source_structure_signals_consistent',
  'explicit_source_references_resolved',
];
const book = {
  source: { sha256: hash },
  pages: [{}],
  resources: [],
} as unknown as CanonicalBookV2;
const report = () => ({
  schema_version: 'ava-reconstruction-report-1',
  source_sha256: hash,
  canonical_sha256: hash,
  epub_sha256: hash,
  resource_hashes: {},
  profile_id: 'ava-pdf-prose-en-v2',
  outcome: 'candidate',
  page_count: 1,
  recognition_task_count: 0,
  checks: Object.fromEntries(checks.map((k) => [k, 'pass'])),
  findings: [],
});
describe('source qualification report', () => {
  it('requires every executable source check without claiming visual inspection', () => {
    expect(
      parseSourceReport(Buffer.from(JSON.stringify(report())), book, hash)
        .checks,
    ).toHaveProperty('source_structure_signals_consistent', 'pass');
  });
  it.each(checks)('rejects omitted %s', (key) => {
    const r = report();
    delete r.checks[key];
    expect(() =>
      parseSourceReport(Buffer.from(JSON.stringify(r)), book, hash),
    ).toThrow('PDF_SOURCE_REPORT_INVALID');
  });
  it.each([Buffer.from('{'), Buffer.from([0xff]), Buffer.from('{}')])(
    'returns a fixed content failure for malformed bytes',
    (bytes) => {
      expect(() => parseSourceReport(bytes, book, hash)).toThrow(
        'PDF_SOURCE_REPORT_INVALID',
      );
    },
  );
});
