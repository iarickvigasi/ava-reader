/* Generated from Python recognition models; do not edit. */

/**
 * @maxItems 0
 */
export type Decisions = [];
/**
 * @minItems 1
 * @maxItems 24
 */
export type FeatureDecisions = [
  SourceFeatureDecision,
  ...SourceFeatureDecision[],
];
/**
 * @minItems 1
 * @maxItems 7
 */
export type Features = [
  SourceFeatureObservation,
  ...SourceFeatureObservation[],
];
export type Disposition = 'observed' | 'unknown' | 'not_applicable';
/**
 * @minItems 1
 * @maxItems 4
 */
export type EvidenceIds = [string, ...string[]];
export type Feature =
  | 'paragraph_role'
  | 'family'
  | 'weight'
  | 'italic'
  | 'first_line_indent'
  | 'block_inset'
  | 'relative_size';
export type Reason =
  | (
      | 'source_blurred'
      | 'source_clipped'
      | 'source_context_insufficient'
      | 'heading_has_no_prose_first_line'
    )
  | null;
export type Value =
  | ('paragraph' | 'quote' | 'serif' | 'sans-serif' | 'monospace')
  | boolean
  | number
  | null;
export type NodeId = string;
export type TextSha256 = string;
export type ImageSha256 = string;
/**
 * @maxItems 0
 */
export type Joins = [];
/**
 * @maxItems 0
 */
export type MetadataDecisions = [];
export type ObservationSha256 = string;
export type SchemaVersion = 'ava-book-refinement-response-4';
export type SourceSha256 = string;
export type TaskId = string;
/**
 * @maxItems 100
 */
export type Unresolved = string[];

export interface SourceFeatureResponse {
  decisions: Decisions;
  feature_decisions: FeatureDecisions;
  image_sha256: ImageSha256;
  joins: Joins;
  metadata_decisions?: MetadataDecisions;
  observation_sha256: ObservationSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
  unresolved: Unresolved;
}
export interface SourceFeatureDecision {
  features: Features;
  node_id: NodeId;
  text_sha256: TextSha256;
}
export interface SourceFeatureObservation {
  disposition: Disposition;
  evidence_ids: EvidenceIds;
  feature: Feature;
  reason: Reason;
  value: Value;
}
