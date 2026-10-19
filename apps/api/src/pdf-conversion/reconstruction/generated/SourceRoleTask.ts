/* Generated from Python recognition models; do not edit. */

/**
 * @minItems 2
 * @maxItems 25
 */
export type Crops = [SourceRoleCrop, SourceRoleCrop, ...SourceRoleCrop[]];
export type Id = string;
/**
 * @minItems 4
 * @maxItems 4
 */
export type ImageBox = [number, number, number, number];
export type NodeId = string | null;
export type Part = 'page' | 'local';
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
export type Nodes = [SourceRoleNode, ...SourceRoleNode[]];
export type Id1 = string;
export type Kind = 'paragraph' | 'quote';
export type OwnerSha256 = string;
export type Page = number;
export type TextExcerpt = string;
export type TextLength = number;
export type TextSha256 = string;
export type ObservationSha256 = string;
export type Page1 = number;
export type PageHeightPt = number;
export type PageWidthPt = number;
export type PixelsPerPoint = 2;
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion = 'ava-book-refinement-9';
export type ResponseSchemaVersion = 'ava-book-refinement-response-6';
export type SchemaVersion = 'ava-book-refinement-task-6';
export type SourceSha256 = string;
export type TaskId = string;

export interface SourceRoleTask {
  crops: Crops;
  image: RecognitionImage;
  nodes: Nodes;
  observation_sha256: ObservationSha256;
  page: Page1;
  page_height_pt: PageHeightPt;
  page_width_pt: PageWidthPt;
  pixels_per_point: PixelsPerPoint;
  profile_id: ProfileId;
  prompt_version: PromptVersion;
  response_schema_version: ResponseSchemaVersion;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
}
export interface SourceRoleCrop {
  id: Id;
  image_box: ImageBox;
  node_id: NodeId;
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
export interface SourceRoleNode {
  id: Id1;
  kind: Kind;
  owner_sha256: OwnerSha256;
  page: Page;
  source_box: Box;
  text_excerpt: TextExcerpt;
  text_length: TextLength;
  text_sha256: TextSha256;
}
