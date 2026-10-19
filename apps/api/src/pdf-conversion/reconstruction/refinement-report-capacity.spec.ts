import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePacket, validatePacket } from './validate-packet';
import { SOURCE_CONTINUATION_POLICY } from '../../library/pdf-import/admission/profile';
import { parseSourceReport } from '../../library/pdf-import/publication/source-report';
import {
  book,
  report,
} from '../../library/pdf-import/publication/source-report-feature-fixture';

const native = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../library/pdf-import/publication/fixtures/native-refinement-report.json',
    ),
    'utf8',
  ),
) as { checks: Record<string, 'pass' | 'not_run'> };
const evidence = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    task_id: `refine-capacity-${i}`,
    task_sha256: 'a'.repeat(64),
    response_sha256: 'b'.repeat(64),
    observation_sha256: 'c'.repeat(64),
    node_ids: [`owner-${i}`],
  }));
const current = (count = 64) => ({
  ...report(),
  schema_version: 'ava-reconstruction-report-3' as const,
  source_continuation_policy: SOURCE_CONTINUATION_POLICY,
  checks: { ...native.checks, ...report().checks },
  refinement_evidence: evidence(count),
});
const parse = (value: unknown, policy?: string) =>
  parseSourceReport(
    Buffer.from(JSON.stringify(value)),
    { ...book, resources: [] },
    'a'.repeat(64),
    true,
    policy,
  );
it('retains64receipts through the actual publication report parser only with captured policy', () => {
  const value = current();
  expect(
    parse(value, SOURCE_CONTINUATION_POLICY).refinement_evidence,
  ).toHaveLength(64);
  expect(() => parse(value)).toThrow('PDF_SOURCE_REPORT_INVALID');
  expect(() => parse(value, 'foreign')).toThrow('PDF_SOURCE_REPORT_INVALID');
});
it('keeps old report2 at32 and rejects task65 or missing current policy/coverage', () => {
  expect(
    validatePacket('ReconstructionReport', {
      ...report(),
      refinement_evidence: evidence(32),
    }),
  ).toBeDefined();
  for (const value of [
    { ...report(), refinement_evidence: evidence(33) },
    current(65),
    { ...current(), source_continuation_policy: undefined },
    { ...current(), source_feature_coverage: undefined },
    { ...current(), checks: {} },
  ])
    expect(() => parse(value, SOURCE_CONTINUATION_POLICY)).toThrow(
      'PDF_SOURCE_REPORT_INVALID',
    );
});
it('preserves the publication report byte limit', () => {
  expect(() =>
    parsePacket(
      'ReconstructionReport',
      Buffer.alloc(4 * 1024 ** 2 + 1),
      4 * 1024 ** 2,
    ),
  ).toThrow('RESOURCE_LIMIT');
});
