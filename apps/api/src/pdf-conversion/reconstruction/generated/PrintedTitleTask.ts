/* Generated from Python recognition models; do not edit. */

/**
 * @minItems 2
 * @maxItems 2
 */
export type Crops = [PrintedTitleCrop, PrintedTitleCrop];
export type Id = string;
/**
 * @minItems 4
 * @maxItems 4
 */
export type ImageBox = [number, number, number, number];
export type NodeId = string;
export type Page = 1;
export type Part = 'title' | 'context';
export type RenderSha256 = string;
export type CoordinateSpace = 'page_points_top_left' | 'normalized_top_left';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type Base64 = string;
export type ByteLength = number;
export type Height = number;
export type MediaType = 'image/png' | 'image/jpeg';
export type Sha256 = string;
export type Width = number;
export type Id1 = string;
export type Method = 'native' | 'ocr';
export type Page1 = 1;
export type PageHeightPt = number;
export type PageWidthPt = number;
export type RenderSha2561 = string;
export type Text = string;
export type TextSha256 = string;
export type ObservationSha256 = string;
export type PixelsPerPoint = 2;
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion = 'ava-printed-title-1';
export type ResponseSchemaVersion = 'ava-printed-title-response-1';
export type SchemaVersion = 'ava-printed-title-task-1';
export type SourceSha256 = string;
export type TaskId = string;

export interface PrintedTitleTask {
  crops: Crops;
  image: RecognitionImage;
  node: PrintedTitleNode;
  observation_sha256: ObservationSha256;
  pixels_per_point: PixelsPerPoint;
  profile_id: ProfileId;
  prompt_version: PromptVersion;
  response_schema_version: ResponseSchemaVersion;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
}
export interface PrintedTitleCrop {
  id: Id;
  image_box: ImageBox;
  node_id: NodeId;
  page: Page;
  part: Part;
  render_sha256: RenderSha256;
  source_box: Box;
}
export interface Box {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
export interface RecognitionImage {
  base64: Base64;
  byte_length: ByteLength;
  height: Height;
  media_type: MediaType;
  sha256: Sha256;
  width: Width;
}
export interface PrintedTitleNode {
  box: Box;
  id: Id1;
  method: Method;
  page: Page1;
  page_height_pt: PageHeightPt;
  page_width_pt: PageWidthPt;
  render_sha256: RenderSha2561;
  text: Text;
  text_sha256: TextSha256;
}
