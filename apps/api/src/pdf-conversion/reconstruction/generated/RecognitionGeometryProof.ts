/* Generated from Python recognition models; do not edit. */

export type OriginalResponseJson = string;
export type OriginalResponseSha256 = string;
export type OriginalResponseSha2561 = string;
export type OriginalTaskId = string;
export type Outcome = 'corrected' | 'unresolved';
export type CoordinateSpace = 'render_normalized_1000';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type SegmentId = string;
/**
 * @maxItems 32
 */
export type Patches = RecognitionGeometryPatch[];
export type RenderSha256 = string;
export type SchemaVersion = 'ava-recognition-geometry-response-1';
export type SourceSha256 = string;
export type TaskId = string;
export type UnresolvedReason =
  | ('IMAGE_UNCLEAR' | 'NO_UNIQUE_SOURCE_BOX')
  | null;

export interface RecognitionGeometryProof {
  original_response_json: OriginalResponseJson;
  original_response_sha256: OriginalResponseSha256;
  response: RecognitionGeometryResponse;
}
export interface RecognitionGeometryResponse {
  original_response_sha256: OriginalResponseSha2561;
  original_task_id: OriginalTaskId;
  outcome: Outcome;
  patches: Patches;
  render_sha256: RenderSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
  unresolved_reason?: UnresolvedReason;
}
export interface RecognitionGeometryPatch {
  box: RecognitionBox;
  segment_id: SegmentId;
}
export interface RecognitionBox {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
