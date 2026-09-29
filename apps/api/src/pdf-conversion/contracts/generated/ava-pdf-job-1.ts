/* Generated from worker JSON Schema; do not edit. */

export type ActiveDeadlineSeconds = number;
export type AttemptFence = number;
export type CancellationEpoch = number;
export type ConfigSha256 = string;
export type DispatchAuthorityId = string | null;
export type Generation = number;
export type Intent = 'initial_pdf_import';
export type LibraryItemId = string;
export type OperationId = string;
export type OwnerId = string;
export type ProfileId = 'ava-pdf-prose-en-v2';
export type ProviderMode = 'native' | 'stub' | 'replay' | 'live';
export type RequestSha256 = string;
export type SchemaVersion = 'ava-pdf-job-1';
export type ScratchByteLimit = number;
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
export type SourcePageLimit = number;
export type WorkerFingerprint = string;

export interface JobInputV1 {
  active_deadline_seconds: ActiveDeadlineSeconds;
  attempt_fence: AttemptFence;
  cancellation_epoch: CancellationEpoch;
  config_sha256: ConfigSha256;
  dispatch_authority_id?: DispatchAuthorityId;
  generation: Generation;
  intent: Intent;
  library_item_id: LibraryItemId;
  operation_id: OperationId;
  owner_id: OwnerId;
  profile_id: ProfileId;
  provider_mode: ProviderMode;
  request_sha256: RequestSha256;
  schema_version: SchemaVersion;
  scratch_byte_limit: ScratchByteLimit;
  source: Artifact;
  source_page_limit: SourcePageLimit;
  worker_fingerprint: WorkerFingerprint;
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
