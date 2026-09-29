/* Generated from worker JSON Schema; do not edit. */

export type AdapterFingerprint = string;
export type Authority = 'server_first_publication';
export type CancellationEpoch = number;
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
export type CanonicalSchema = 'ava-book-2';
export type CapabilityReportSha256 = string;
export type ConfigSha256 = string;
export type FinalContentId = string;
export type LibraryItemId = string;
export type OperationId = string;
export type OwnerId = string;
export type ProfileId = 'ava-pdf-prose-en-v2';
export type PublicationFence = number;
export type ReaderBuildFingerprint = string;
export type ReaderSchema = 'ava-reader-3';
/**
 * @maxItems 1000
 */
export type Resources = Artifact[];
export type SchemaVersion = 'ava-accepted-content-1';

export interface AcceptedContentV1 {
  adapter_fingerprint: AdapterFingerprint;
  authority: Authority;
  cancellation_epoch: CancellationEpoch;
  canonical_book: Artifact;
  canonical_schema: CanonicalSchema;
  capability_report_sha256: CapabilityReportSha256;
  config_sha256: ConfigSha256;
  epub: Artifact;
  final_content_id: FinalContentId;
  library_item_id: LibraryItemId;
  operation_id: OperationId;
  owner_id: OwnerId;
  profile_id: ProfileId;
  publication_fence: PublicationFence;
  reader_build_fingerprint: ReaderBuildFingerprint;
  reader_package: Artifact;
  reader_schema: ReaderSchema;
  resources: Resources;
  schema_version: SchemaVersion;
  source: Artifact;
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
