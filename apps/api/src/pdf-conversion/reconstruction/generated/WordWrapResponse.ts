/* Generated from Python recognition models; do not edit. */

export type CatalogueSha256 = string;
/**
 * @minItems 1
 * @maxItems 128
 */
export type Decisions = [WordWrapDecision, ...WordWrapDecision[]];
export type Disposition = 'layout' | 'literal' | 'unresolved';
export type Id = string;
export type ObservationSha256 = string;
export type SchemaVersion = 'ava-native-word-wrap-response-1';
export type SourceSha256 = string;
export type TaskId = string;

export interface WordWrapResponse {
  catalogue_sha256: CatalogueSha256;
  decisions: Decisions;
  observation_sha256: ObservationSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
}
export interface WordWrapDecision {
  disposition: Disposition;
  id: Id;
}
