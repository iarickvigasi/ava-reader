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
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type RecognitionTaskCount = number;
/**
 * @minItems 1
 * @maxItems 48
 */
export type NodeIds = [string, ...string[]];
export type ObservationSha256 = string;
export type ResponseSha256 = string;
export type TaskId = string;
export type TaskSha256 = string;
/**
 * @maxItems 32
 */
export type RefinementEvidence = RefinementEvidence1[];
export type SchemaVersion =
  | 'ava-reconstruction-report-1'
  | 'ava-reconstruction-report-2';
export type CanonicalBlockId = string | null;
export type CanonicalStart = number | null;
/**
 * @maxItems 4
 */
export type CropIds = string[];
export type CropSha256 = string | null;
export type Disposition = 'observed' | 'unknown' | 'not_applicable';
export type Feature =
  | 'paragraph_role'
  | 'family'
  | 'weight'
  | 'italic'
  | 'first_line_indent'
  | 'block_inset'
  | 'relative_size';
export type NodeId = string;
export type ObservationSha2561 = string;
export type Page1 = number;
export type Reason =
  | (
      | 'source_blurred'
      | 'source_clipped'
      | 'source_context_insufficient'
      | 'heading_has_no_prose_first_line'
      | 'comparison_budget_bound'
      | 'source_context_unavailable'
    )
  | null;
export type ResponseSha2561 = string | null;
export type SourceSha256 = string;
export type TaskId1 = string | null;
export type TaskSha2561 = string | null;
export type TextLength = number;
export type TextSha256 = string;
export type Value =
  | ('paragraph' | 'quote' | 'serif' | 'sans-serif' | 'monospace')
  | boolean
  | number
  | null;
/**
 * @maxItems 1792
 */
export type Evidence = SourceFeatureEvidence[];
export type InspectedFeatures = number;
export type PolicyId = 'ava-ocr-source-features-1';
export type RequestedFeatures = number;
export type UninspectedFeatures = number;
export type UnrequestedOptionalCandidates = number;
export type SourceSha2561 = string;

export interface ReconstructionReport {
  canonical_sha256: CanonicalSha256;
  checks: Checks;
  epub_sha256: EpubSha256;
  findings: Findings;
  outcome: Outcome;
  page_count: PageCount;
  profile_id: ProfileId;
  recognition_task_count: RecognitionTaskCount;
  refinement_evidence?: RefinementEvidence;
  resource_hashes: ResourceHashes;
  schema_version: SchemaVersion;
  source_feature_coverage?: SourceFeatureCoverage | null;
  source_sha256: SourceSha2561;
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
export interface RefinementEvidence1 {
  node_ids: NodeIds;
  observation_sha256: ObservationSha256;
  response_sha256: ResponseSha256;
  task_id: TaskId;
  task_sha256: TaskSha256;
}
export interface ResourceHashes {
  [k: string]: string;
}
export interface SourceFeatureCoverage {
  evidence: Evidence;
  inspected_features: InspectedFeatures;
  policy_id: PolicyId;
  requested_features: RequestedFeatures;
  uninspected_features: UninspectedFeatures;
  unrequested_optional_candidates: UnrequestedOptionalCandidates;
}
export interface SourceFeatureEvidence {
  box: Box;
  canonical_block_id?: CanonicalBlockId;
  canonical_start?: CanonicalStart;
  crop_ids: CropIds;
  crop_sha256: CropSha256;
  disposition: Disposition;
  feature: Feature;
  node_id: NodeId;
  observation_sha256: ObservationSha2561;
  page: Page1;
  reason: Reason;
  response_sha256: ResponseSha2561;
  source_sha256: SourceSha256;
  task_id: TaskId1;
  task_sha256: TaskSha2561;
  text_length: TextLength;
  text_sha256: TextSha256;
  value: Value;
}
