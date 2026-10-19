import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixtureBytes } from '../contracts/contract-fixtures';
import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';
import type { JobInputV1 } from '../contracts/generated/ava-pdf-job-1';
import type { ReconstructionReport } from './generated/ReconstructionReport';

// Host ordering/staging control only; the authored canonical graph does not
// establish extraction, and these EPUB bytes are deliberately not a real book.
export function attemptCandidateFixture(currentPolicy = true) {
  const source = Buffer.from('%PDF-synthetic-host-protocol-control');
  const sha = (bytes: Buffer) =>
    createHash('sha256').update(bytes).digest('hex');
  const job = JSON.parse(
    fixtureBytes('ava-pdf-job-1').toString(),
  ) as JobInputV1;
  job.source = {
    ...job.source,
    path: 'source.pdf',
    sha256: sha(source),
    byte_length: source.length,
  };
  const book = JSON.parse(
    fixtureBytes('ava-book-2').toString(),
  ) as CanonicalBookV2;
  book.source = {
    ...book.source,
    sha256: job.source.sha256,
    byte_length: source.length,
  };
  const image = readFileSync(
    resolve(
      __dirname,
      '../../../../../packages/pdf-epub/tests/epub_v2/fixtures/assets/images/window.png',
    ),
  );
  book.resources[0].sha256 = sha(image);
  book.resources[0].path = `images/${sha(image)}.png`;
  book.resources[0].byte_length = image.length;
  const canonical = Buffer.from(JSON.stringify(book));
  const epub = Buffer.from('synthetic host EPUB bytes');
  const report: ReconstructionReport = {
    schema_version: currentPolicy
      ? 'ava-reconstruction-report-2'
      : 'ava-reconstruction-report-1',
    profile_id: job.profile_id,
    source_sha256: job.source.sha256,
    canonical_sha256: sha(canonical),
    epub_sha256: sha(epub),
    resource_hashes: { [book.resources[0].id]: sha(image) },
    outcome: 'candidate',
    page_count: book.pages.length,
    recognition_task_count: 0,
    checks: currentPolicy
      ? { finite_source_feature_dispositions_complete: 'pass' }
      : {},
    findings: [],
    refinement_evidence: [],
    ...(currentPolicy
      ? {
          source_feature_coverage: {
            policy_id: 'ava-ocr-source-features-1' as const,
            requested_features: 0,
            inspected_features: 0,
            uninspected_features: 0,
            unrequested_optional_candidates: 0,
            evidence: [],
          },
        }
      : {}),
  };
  const bodies: Record<string, Buffer> = {
    'canonical.json': canonical,
    'book.epub': epub,
    'reconstruction-report.json': Buffer.from(JSON.stringify(report)),
    [book.resources[0].path]: image,
  };
  const artifacts = Object.entries(bodies).map(([path, bytes]) => ({
    path,
    byte_length: bytes.length,
    sha256: sha(bytes),
  }));
  const lines = [
    JSON.stringify({
      schema_version: 'ava-reconstruct-stream-1',
      report,
      artifacts,
    }),
  ];
  for (const [path, bytes] of Object.entries(bodies))
    lines.push(
      JSON.stringify({ path, offset: 0, base64: bytes.toString('base64') }),
    );
  lines.push(JSON.stringify({ complete: true }));
  return {
    source,
    job,
    book,
    report,
    artifacts,
    stream: Buffer.from(lines.join('\n') + '\n'),
  };
}
