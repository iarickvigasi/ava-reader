/* Generated from Python recognition models; do not edit. */

export type CanonicalSha256 = string;
export type EpubSha256 = string;
export type BlockId = string | null;
export type CoordinateSpace = 'page_points_top_left' | 'normalized_top_left';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type Code = string;
export type Message = string;
export type Page = number | null;
export type Severity = 'blocking' | 'review' | 'information';
/**
 * @maxItems 10000
 */
export type Findings = Finding[];
export type Outcome = 'candidate';
export type PageCount = number;
export type ProfileId = 'ava-pdf-prose-en-v2';
export type RecognitionTaskCount = number;
export type SchemaVersion = 'ava-reconstruction-report-1';
export type SourceSha256 = string;

export interface ReconstructionReport {
  canonical_sha256: CanonicalSha256;
  checks: Checks;
  epub_sha256: EpubSha256;
  findings: Findings;
  outcome: Outcome;
  page_count: PageCount;
  profile_id: ProfileId;
  recognition_task_count: RecognitionTaskCount;
  resource_hashes: ResourceHashes;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
}
export interface Checks {
  [k: string]: 'pass' | 'not_run';
}
export interface Finding {
  block_id?: BlockId;
  box?: Box | null;
  code: Code;
  message: Message;
  page?: Page;
  severity: Severity;
}
export interface Box {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
export interface ResourceHashes {
  [k: string]: string;
}
