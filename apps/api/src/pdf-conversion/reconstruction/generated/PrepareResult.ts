/* Generated from Python recognition models; do not edit. */

export type NativeSegmentCount = number;
export type ObservationSha256 = string;
export type PageNumber = number;
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type SchemaVersion = 'ava-prepare-result-1';
export type SourcePageCount = number;
export type SourceSha256 = string;
export type Base64 = string;
export type ByteLength = number;
export type Height = number;
export type MediaType = 'image/png' | 'image/jpeg';
export type Sha256 = string;
export type Width = number;
export type NativeEvidence = string;
export type NativeEvidenceSha256 = string;
export type PageHeightPt = number;
export type PageNumber1 = number;
export type PageWidthPt = number;
export type ProfileId1 = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion =
  | 'ava-prose-region-2'
  | 'ava-prose-region-3'
  | 'ava-prose-region-4'
  | 'ava-prose-region-5'
  | 'ava-prose-region-6'
  | 'ava-prose-region-7'
  | 'ava-prose-region-8'
  | 'ava-prose-region-9'
  | 'ava-prose-region-10'
  | 'ava-prose-region-11'
  | 'ava-prose-region-12'
  | 'ava-prose-region-13'
  | 'ava-prose-region-14'
  | 'ava-prose-region-15'
  | 'ava-prose-region-16';
export type Purpose = 'pdf_region_recognition' | 'pdf_structure_repair';
export type CoordinateSpace = 'page_points_top_left' | 'normalized_top_left';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type ResponseSchemaVersion = 'ava-recognition-response-2';
export type SchemaVersion1 = 'ava-recognition-task-1';
export type SourceSha2561 = string;
export type TaskId = string;
/**
 * @maxItems 50
 */
export type Tasks = RecognitionTask[];

export interface PrepareResult {
  native_segment_count: NativeSegmentCount;
  observation_sha256: ObservationSha256;
  page_number: PageNumber;
  profile_id?: ProfileId;
  schema_version: SchemaVersion;
  source_page_count: SourcePageCount;
  source_sha256: SourceSha256;
  tasks: Tasks;
}
export interface RecognitionTask {
  image: RecognitionImage;
  native_evidence: NativeEvidence;
  native_evidence_sha256: NativeEvidenceSha256;
  page_height_pt: PageHeightPt;
  page_number: PageNumber1;
  page_width_pt: PageWidthPt;
  profile_id: ProfileId1;
  prompt_version: PromptVersion;
  purpose: Purpose;
  region_box: Box;
  response_schema_version: ResponseSchemaVersion;
  schema_version: SchemaVersion1;
  source_sha256: SourceSha2561;
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
export interface Box {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
