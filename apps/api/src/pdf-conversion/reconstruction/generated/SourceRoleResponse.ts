/* Generated from Python recognition models; do not edit. */

export type ImageSha256 = string;
export type ObservationSha256 = string;
/**
 * @minItems 1
 * @maxItems 24
 */
export type RoleDecisions = [SourceRoleDecision, ...SourceRoleDecision[]];
/**
 * @minItems 2
 * @maxItems 2
 */
export type EvidenceIds = [string, string];
export type NodeId = string;
export type Reason =
  | ('source_blurred' | 'source_clipped' | 'source_context_insufficient')
  | null;
export type Role = ('paragraph' | 'quote') | null;
export type TextSha256 = string;
export type SchemaVersion = 'ava-book-refinement-response-6';
export type SourceSha256 = string;
export type TaskId = string;
/**
 * @maxItems 100
 */
export type Unresolved = string[];

export interface SourceRoleResponse {
  image_sha256: ImageSha256;
  observation_sha256: ObservationSha256;
  role_decisions: RoleDecisions;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
  unresolved: Unresolved;
}
export interface SourceRoleDecision {
  evidence_ids: EvidenceIds;
  node_id: NodeId;
  reason: Reason;
  role: Role;
  text_sha256: TextSha256;
}
