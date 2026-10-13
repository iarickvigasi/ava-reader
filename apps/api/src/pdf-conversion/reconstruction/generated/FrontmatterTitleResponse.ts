/* Generated from Python recognition models; do not edit. */

/**
 * @minItems 2
 * @maxItems 9
 */
export type EvidenceIds = [string, string, ...string[]];
/**
 * @minItems 1
 * @maxItems 8
 */
export type NodeIds = [string, ...string[]];
/**
 * @maxItems 2
 */
export type EvidenceIds1 = string[];
export type ImageSha256 = string;
export type ObservationSha256 = string;
export type SchemaVersion = 'ava-printed-title-response-2';
export type SelectedNodeId = string | null;
export type SelectedTextSha256 = string | null;
export type SourceSha256 = string;
export type TaskId = string;

export interface FrontmatterTitleResponse {
  cover: FrontmatterCoverCorroboration | null;
  evidence_ids: EvidenceIds1;
  image_sha256: ImageSha256;
  observation_sha256: ObservationSha256;
  schema_version: SchemaVersion;
  selected_node_id: SelectedNodeId;
  selected_text_sha256: SelectedTextSha256;
  source_sha256: SourceSha256;
  task_id: TaskId;
}
export interface FrontmatterCoverCorroboration {
  evidence_ids: EvidenceIds;
  node_ids: NodeIds;
}
