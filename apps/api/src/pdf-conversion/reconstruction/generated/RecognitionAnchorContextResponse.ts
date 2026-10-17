/* Generated from Python recognition models; do not edit. */

export type OriginalResponseSha256 = string;
export type OriginalTaskId = string;
export type Outcome = 'corrected' | 'unresolved';
export type After = string;
export type Before = string;
export type SegmentIndex = number;
export type SpanIndex = number;
export type SpanSha256 = string;
/**
 * @maxItems 512
 */
export type Patches = AnchorContextPatch[];
export type RenderSha256 = string;
export type SchemaVersion = 'ava-recognition-anchor-context-response-1';
export type SourceSha256 = string;
export type TaskId = string;
export type UnresolvedReason = ('NO_UNIQUE_CONTEXT' | 'IMAGE_UNCLEAR') | null;

export interface RecognitionAnchorContextResponse {
  original_response_sha256: OriginalResponseSha256;
  original_task_id: OriginalTaskId;
  outcome: Outcome;
  patches: Patches;
  render_sha256: RenderSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
  unresolved_reason?: UnresolvedReason;
}
export interface AnchorContextPatch {
  after: After;
  before: Before;
  segment_index: SegmentIndex;
  span_index: SpanIndex;
  span_sha256: SpanSha256;
}
