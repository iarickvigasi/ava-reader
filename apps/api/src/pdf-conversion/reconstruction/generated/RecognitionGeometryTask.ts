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
export type PromptVersion = 'ava-recognition-geometry-1';
export type Purpose = 'repair_recognition_geometry';
export type RenderSha256 = string;
export type ResponseSchemaVersion = 'ava-recognition-geometry-response-1';
export type SchemaVersion = 'ava-recognition-geometry-task-1';
/**
 * @minItems 1
 * @maxItems 32
 */
export type Slots = [RecognitionGeometrySlot, ...RecognitionGeometrySlot[]];
export type Context = string;
export type Kind =
  | 'paragraph'
  | 'heading'
  | 'quote'
  | 'aside'
  | 'caption'
  | 'credit'
  | 'verse'
  | 'code'
  | 'list_item'
  | 'note'
  | 'figure'
  | 'table'
  | 'separator'
  | 'furniture'
  | 'unsupported';
export type OriginalBoxJson = string;
export type OriginalBoxSha256 = string;
export type Reason = 'EMPTY_OR_REVERSED_BOX';
export type SegmentId = string;
export type SegmentIndex = number;
export type SegmentTextSha256 = string;
export type SourceSha256 = string;
export type TaskId = string;

export interface RecognitionGeometryTask {
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
export interface RecognitionGeometrySlot {
  context: Context;
  kind: Kind;
  original_box_json: OriginalBoxJson;
  original_box_sha256: OriginalBoxSha256;
  reason: Reason;
  segment_id: SegmentId;
  segment_index: SegmentIndex;
  segment_text_sha256: SegmentTextSha256;
}
