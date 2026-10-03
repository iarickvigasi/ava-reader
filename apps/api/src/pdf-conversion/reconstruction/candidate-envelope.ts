import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';
import type { JobInputV1 } from '../contracts/generated/ava-pdf-job-1';
import type {
  Artifact,
  WorkerResultV1,
} from '../contracts/generated/ava-pdf-worker-result-1';
import type { StreamArtifact } from '../runtime/stream-schema';
import type { ReconstructionReport } from './generated/ReconstructionReport';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function candidateEnvelope(
  job: JobInputV1,
  book: CanonicalBookV2,
  report: ReconstructionReport,
  artifacts: StreamArtifact[],
): WorkerResultV1 {
  const resourceIds = new Map(book.resources.map((r) => [r.path, r.id]));
  const fixed = {
    'canonical.json': [
      'canonical',
      'CANONICAL_BOOK',
      'CANONICAL_JSON',
      'application/json',
    ],
    'book.epub': ['epub', 'DERIVED_EPUB', 'EPUB', 'application/epub+zip'],
    'reconstruction-report.json': [
      'report',
      'VALIDATION_REPORT',
      'REPORT_JSON',
      'application/json',
    ],
  } as const;
  const mapped: Artifact[] = artifacts.map((a) => {
    const spec = fixed[a.path as keyof typeof fixed];
    const resource = book.resources.find((r) => r.path === a.path);
    if (
      !spec &&
      (!resource ||
        resource.sha256 !== a.sha256 ||
        resource.byte_length !== a.byte_length)
    )
      throw new PdfRuntimeError('INVALID_RESULT');
    return {
      ...a,
      id: spec?.[0] ?? resourceIds.get(a.path)!,
      role: spec?.[1] ?? 'RESOURCE',
      format: spec?.[2] ?? 'IMAGE',
      media_type: spec?.[3] ?? resource!.media_type,
    };
  });
  if (
    mapped.length !== book.resources.length + 3 ||
    new Set(mapped.map((a) => a.id)).size !== mapped.length
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  const required = (path: string) => {
    const item = mapped.find((a) => a.path === path);
    if (!item) throw new PdfRuntimeError('INVALID_RESULT');
    return item;
  };
  if (
    report.source_sha256 !== job.source.sha256 ||
    report.epub_sha256 !== required('book.epub').sha256 ||
    book.source.sha256 !== job.source.sha256 ||
    Object.keys(report.resource_hashes).length !== book.resources.length ||
    book.resources.some((r) => report.resource_hashes[r.id] !== r.sha256)
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  return {
    schema_version: 'ava-pdf-worker-result-1',
    operation_id: job.operation_id,
    request_sha256: job.request_sha256,
    config_sha256: job.config_sha256,
    worker_fingerprint: job.worker_fingerprint,
    source_sha256: job.source.sha256,
    profile_id: job.profile_id,
    generation: job.generation,
    attempt_fence: job.attempt_fence,
    cancellation_epoch: job.cancellation_epoch,
    outcome: {
      status: 'candidate',
      candidate_id: `candidate-${report.canonical_sha256}`,
      canonical_schema: 'ava-book-2',
      cli_exit_code: 2,
      publication_eligible: false,
      canonical_book: required('canonical.json'),
      epub: required('book.epub'),
      validation_report: required('reconstruction-report.json'),
      resources: mapped.filter((a) => a.role === 'RESOURCE'),
      finding_codes: report.findings.map((f) => f.code),
    },
  };
}
