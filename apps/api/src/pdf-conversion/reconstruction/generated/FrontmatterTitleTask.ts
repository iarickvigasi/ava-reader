/* Generated from Python recognition models; do not edit. */

/**
 * @minItems 2
 * @maxItems 40
 */
export type Crops = [
  FrontmatterTitleCrop,
  FrontmatterTitleCrop,
  ...FrontmatterTitleCrop[],
];
export type Id = string;
/**
 * @minItems 4
 * @maxItems 4
 */
export type ImageBox = [number, number, number, number];
export type NodeId = string | null;
export type Page = number;
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
/**
 * @minItems 1
 * @maxItems 24
 */
export type Nodes = [FrontmatterTitleNode, ...FrontmatterTitleNode[]];
export type Id1 = string;
export type Method = 'native' | 'ocr';
export type Page1 = number;
export type PageHeightPt = number;
export type PageWidthPt = number;
export type PrimaryEligible = boolean;
export type RenderSha2561 = string;
export type Text = string;
export type TextSha256 = string;
export type ObservationSha256 = string;
/**
 * @minItems 1
 * @maxItems 16
 */
export type Pages = [FrontmatterTitlePage, ...FrontmatterTitlePage[]];
export type Page2 = number;
export type PageHeightPt1 = number;
export type PageWidthPt1 = number;
export type RenderSha2562 = string;
export type PixelsPerPoint = 2;
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion = 'ava-printed-title-2';
export type ResponseSchemaVersion = 'ava-printed-title-response-2';
export type SchemaVersion = 'ava-printed-title-task-2';
export type SourcePageCount = number;
export type SourceSha256 = string;
export type TaskId = string;

export interface FrontmatterTitleTask {
  crops: Crops;
  image: RecognitionImage;
  nodes: Nodes;
  observation_sha256: ObservationSha256;
  pages: Pages;
  pixels_per_point: PixelsPerPoint;
  profile_id: ProfileId;
  prompt_version: PromptVersion;
  response_schema_version: ResponseSchemaVersion;
  schema_version: SchemaVersion;
  source_page_count: SourcePageCount;
  source_sha256: SourceSha256;
  task_id: TaskId;
}
export interface FrontmatterTitleCrop {
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
export interface FrontmatterTitleNode {
  box: Box;
  id: Id1;
  method: Method;
  page: Page1;
  page_height_pt: PageHeightPt;
  page_width_pt: PageWidthPt;
  primary_eligible: PrimaryEligible;
  render_sha256: RenderSha2561;
  text: Text;
  text_sha256: TextSha256;
}
export interface FrontmatterTitlePage {
  page: Page2;
  page_height_pt: PageHeightPt1;
  page_width_pt: PageWidthPt1;
  render_sha256: RenderSha2562;
}
