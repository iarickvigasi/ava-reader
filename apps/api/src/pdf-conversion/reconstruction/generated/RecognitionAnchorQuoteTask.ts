/* Generated from Python recognition models; do not edit. */

export type Base64 = string;
export type ByteLength = number;
export type Height = number;
export type MediaType = 'image/png' | 'image/jpeg';
export type Sha256 = string;
export type Width = number;
export type NativeEvidenceSha256 = string;
export type OriginalResponseJson = string;
export type OriginalResponseSha256 = string;
export type OriginalTaskId = string;
export type PageNumber = number;
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion = 'ava-recognition-anchor-quote-2';
export type Purpose = 'repair_inline_anchor_quote';
export type RenderSha256 = string;
export type ResponseSchemaVersion = 'ava-recognition-anchor-quote-response-2';
export type SchemaVersion = 'ava-recognition-anchor-quote-task-2';
/**
 * @minItems 1
 * @maxItems 512
 */
export type Slots = [AnchorQuoteSlot, ...AnchorQuoteSlot[]];
/**
 * @minItems 1
 * @maxItems 2
 */
export type AllowedQuotations = [string, ...string[]];
export type OriginalSpanJson = string;
export type Reason = 'AMBIGUOUS_CONTEXT' | 'ABSENT_CONTEXT';
export type SegmentId = string;
export type SegmentIndex = number;
export type SegmentTextSha256 = string;
export type SpanIndex = number;
export type SpanSha256 = string;
export type SourceSha256 = string;
export type TaskId = string;

export interface RecognitionAnchorQuoteTask {
  image: RecognitionImage;
  native_evidence_sha256: NativeEvidenceSha256;
  original_response_json: OriginalResponseJson;
  original_response_sha256: OriginalResponseSha256;
  original_task_id: OriginalTaskId;
  page_number: PageNumber;
  profile_id: ProfileId;
  prompt_version: PromptVersion;
  purpose: Purpose;
  render_sha256: RenderSha256;
  response_schema_version: ResponseSchemaVersion;
  schema_version: SchemaVersion;
  slots: Slots;
  source_sha256: SourceSha256;
  task_id: TaskId;
}
export interface RecognitionImage {
  base64: Base64;
  byte_length: ByteLength;
  height: Height;
  media_type: MediaType;
  sha256: Sha256;
  width: Width;
}
export interface AnchorQuoteSlot {
  allowed_quotations: AllowedQuotations;
  original_span_json: OriginalSpanJson;
  reason: Reason;
  segment_id: SegmentId;
  segment_index: SegmentIndex;
  segment_text_sha256: SegmentTextSha256;
  span_index: SpanIndex;
  span_sha256: SpanSha256;
}
