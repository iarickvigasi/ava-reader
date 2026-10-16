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
export type PromptVersion = 'ava-recognition-cell-geometry-1';
export type Purpose = 'repair_recognition_cell_geometry';
export type RenderSha256 = string;
export type ResponseSchemaVersion = 'ava-recognition-cell-geometry-response-1';
export type SchemaVersion = 'ava-recognition-cell-geometry-task-1';
/**
 * @minItems 1
 * @maxItems 32
 */
export type Slots = [
  RecognitionCellGeometrySlot,
  ...RecognitionCellGeometrySlot[],
];
export type CellIndex = number;
export type CellTextSha256 = string;
export type Context = string;
export type OriginalBoxJson = string;
export type OriginalBoxSha256 = string;
/**
 * @maxItems 8
 */
export type RowContext = string[];
export type RowIndex = number;
export type SegmentId = string;
export type SegmentIndex = number;
export type SlotId = string;
export type CoordinateSpace = 'render_normalized_1000';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type SourceSha256 = string;
export type TaskId = string;

export interface RecognitionCellGeometryTask {
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
export interface RecognitionCellGeometrySlot {
  cell_index: CellIndex;
  cell_text_sha256: CellTextSha256;
  context: Context;
  original_box_json: OriginalBoxJson;
  original_box_sha256: OriginalBoxSha256;
  row_context: RowContext;
  row_index: RowIndex;
  segment_id: SegmentId;
  segment_index: SegmentIndex;
  slot_id: SlotId;
  table_box: RecognitionBox;
}
export interface RecognitionBox {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
