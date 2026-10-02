/* Generated from worker JSON Schema; do not edit. */

export type AttemptFence = number;
export type CancellationEpoch = number;
export type ConfigSha256 = string;
export type Generation = number;
export type OperationId = string;
export type Outcome = CandidateOutcome | FailureOutcome;
export type CandidateId = string;
export type ByteLength = number;
export type Format =
  | 'PDF'
  | 'CANONICAL_JSON'
  | 'EPUB'
  | 'READER_PACKAGE'
  | 'REPORT_JSON'
  | 'IMAGE';
export type Id = string;
export type MediaType =
  | 'application/pdf'
  | 'application/json'
  | 'application/epub+zip'
  | 'image/png'
  | 'image/jpeg';
export type Path = string;
export type Role =
  | 'SOURCE_PDF'
  | 'CANONICAL_BOOK'
  | 'DERIVED_EPUB'
  | 'DERIVED_READER'
  | 'VALIDATION_REPORT'
  | 'DIAGNOSTIC'
  | 'RESOURCE';
export type Sha256 = string;
export type CanonicalSchema = 'ava-book-1' | 'ava-book-2';
export type CliExitCode = 0 | 2;
/**
 * @maxItems 1000
 */
export type FindingCodes = string[];
export type PublicationEligible = false;
/**
 * @maxItems 1000
 */
export type Resources = Artifact[];
export type Status = 'candidate';
export type CliExitCode1 = 1;
export type Code = string;
export type FailureId = string;
export type InvestigationRequired = true;
export type NotificationRequired = true;
export type ReaderRetryAllowed = false;
export type SafeReason = string;
export type Stage =
  | 'preflight'
  | 'extraction'
  | 'reconstruction'
  | 'assembly'
  | 'validation';
export type Status1 = 'failed' | 'unsupported';
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type RequestSha256 = string;
export type SchemaVersion = 'ava-pdf-worker-result-1';
export type SourceSha256 = string;
export type WorkerFingerprint = string;

export interface WorkerResultV1 {
  attempt_fence: AttemptFence;
  cancellation_epoch: CancellationEpoch;
  config_sha256: ConfigSha256;
  generation: Generation;
  operation_id: OperationId;
  outcome: Outcome;
  profile_id: ProfileId;
  request_sha256: RequestSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  worker_fingerprint: WorkerFingerprint;
}
export interface CandidateOutcome {
  candidate_id: CandidateId;
  canonical_book: Artifact;
  canonical_schema: CanonicalSchema;
  cli_exit_code: CliExitCode;
  epub: Artifact;
  finding_codes: FindingCodes;
  publication_eligible: PublicationEligible;
  resources: Resources;
  status: Status;
  validation_report: Artifact;
}
export interface Artifact {
  byte_length: ByteLength;
  format: Format;
  id: Id;
  media_type: MediaType;
  path: Path;
  role: Role;
  sha256: Sha256;
}
export interface FailureOutcome {
  cli_exit_code: CliExitCode1;
  code: Code;
  diagnostic: Artifact;
  failure_id: FailureId;
  investigation_required: InvestigationRequired;
  notification_required: NotificationRequired;
  reader_retry_allowed: ReaderRetryAllowed;
  safe_reason: SafeReason;
  stage: Stage;
  status: Status1;
}
