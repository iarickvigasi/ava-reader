/* Generated from Python recognition models; do not edit. */

/**
 * @minItems 2
 * @maxItems 2
 */
export type EvidenceIds = [string, string];
export type NodeId = string;
export type Role = 'title' | null;
export type TextSha256 = string;
export type ImageSha256 = string;
export type ObservationSha256 = string;
export type SchemaVersion = 'ava-printed-title-response-1';
export type SourceSha256 = string;
export type TaskId = string;

export interface PrintedTitleResponse {
  decision: PrintedTitleDecision;
  image_sha256: ImageSha256;
  observation_sha256: ObservationSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
}
export interface PrintedTitleDecision {
  evidence_ids: EvidenceIds;
  node_id: NodeId;
  role: Role;
  text_sha256: TextSha256;
}
