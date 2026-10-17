import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSourceReport } from './source-report';
import type { CanonicalBookV2 } from '../../../pdf-conversion/contracts/generated/ava-book-2';
import type { ReconstructionReport } from '../../../pdf-conversion/reconstruction/generated/ReconstructionReport';

// Exact worker report from the authored native fixture; no provider payload or user content.
const bytes = readFileSync(
  join(__dirname, 'fixtures/native-refinement-report.json'),
);
const native = JSON.parse(bytes.toString()) as ReconstructionReport;
const book = {
  source: { sha256: native.source_sha256 },
  pages: Array.from({ length: native.page_count }, () => ({})),
  resources: Object.entries(native.resource_hashes).map(([id, sha256]) => ({
    id,
    sha256,
  })),
} as unknown as CanonicalBookV2;
const evidence = {
  task_id: 'refine-example',
  task_sha256: 'a'.repeat(64),
  response_sha256: 'b'.repeat(64),
  observation_sha256: 'c'.repeat(64),
  node_ids: ['heading-1'],
};
const parse = (value: unknown) =>
  parseSourceReport(
    Buffer.from(JSON.stringify(value)),
    book,
    native.epub_sha256,
  );
describe('current worker report reaches publication validation', () => {
  it('accepts the exact previously rejected native report with empty refinement evidence', () => {
    expect(
      parseSourceReport(bytes, book, native.epub_sha256).refinement_evidence,
    ).toEqual([]);
  });
  it('retains well-formed source-bound refinement evidence without claiming visual approval', () => {
    const value = parse({
      ...native,
      recognition_task_count: 3,
      refinement_evidence: [evidence],
    });
    expect(value.refinement_evidence).toEqual([evidence]);
    expect(value.checks.independent_visual_source_fidelity).toBe('not_run');
  });
  it.each([
    { ...native, unrecognized: true },
    { ...native, refinement_evidence: [{ ...evidence, task_sha256: 'bad' }] },
    {
      ...native,
      refinement_evidence: [{ ...evidence, text: 'replacement text' }],
    },
    {
      ...native,
      refinement_evidence: Array.from({ length: 33 }, () => evidence),
    },
    {
      ...native,
      checks: {
        ...native.checks,
        source_structure_signals_consistent: 'not_run',
      },
    },
  ])('refuses malformed evidence and unresolved source checks', (value) => {
    expect(() => parse(value)).toThrow('PDF_SOURCE_REPORT_INVALID');
  });
});
