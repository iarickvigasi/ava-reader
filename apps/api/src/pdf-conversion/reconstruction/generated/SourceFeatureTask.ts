/* Generated from Python recognition models; do not edit. */

/**
 * @minItems 1
 * @maxItems 48
 */
export type Crops = [SourceFeatureCrop, ...SourceFeatureCrop[]];
export type Id = string;
/**
 * @minItems 4
 * @maxItems 4
 */
export type ImageBox = [number, number, number, number];
export type NodeId = string;
export type Page = number;
export type Part = 'context';
export type RenderSha256 = string;
export type RequestNodeId = string;
export type CoordinateSpace = 'page_points_top_left' | 'normalized_top_left';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
/**
 * @maxItems 0
 */
export type DecisionIds = [];
/**
 * @maxItems 0
 */
export type Edges = [];
export type Base64 = string;
export type ByteLength = number;
export type Height = number;
export type MediaType = 'image/png' | 'image/jpeg';
export type Sha256 = string;
export type Width = number;
/**
 * @maxItems 0
 */
export type MetadataIds = [];
/**
 * @minItems 1
 * @maxItems 256
 */
export type Nodes = [SourceFeatureNode, ...SourceFeatureNode[]];
export type BodyReferenceId = string | null;
export type CandidateOriginalKind = null;
export type Id1 = string;
export type Kind = 'heading' | 'paragraph' | 'quote';
export type ObservationMethod = 'native' | 'ocr' | 'render';
export type ObservedChapter = boolean;
export type ObservedLevel = number | null;
export type ObservedRole = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type Align = ('start' | 'left' | 'right' | 'center' | 'justify') | null;
export type BackgroundColor = string | null;
export type BlockIndentEm = number | null;
export type Bold = boolean | null;
export type Color = string | null;
export type DecorationColor = string | null;
export type Family = ('serif' | 'sans-serif' | 'monospace') | null;
export type Id2 = string;
export type IndentEm = number | null;
export type Italic = boolean | null;
export type LineHeight = number | null;
export type RelativeSize = number | null;
export type SmallCaps = boolean | null;
export type SpaceAfterEm = number | null;
export type SpaceBeforeEm = number | null;
export type StrikeThrough = boolean | null;
export type Underline = boolean | null;
export type VerticalAlign = ('baseline' | 'super' | 'sub') | null;
export type Page1 = number;
export type RankedSource = true;
export type StructureCandidate = false;
export type TextExcerpt = string;
export type TextLength = number;
export type TextSha256 = string;
export type ObservationSha256 = string;
export type PixelsPerPoint = 2;
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion = 'ava-book-refinement-7';
export type ResponseSchemaVersion = 'ava-book-refinement-response-4';
export type SchemaVersion = 'ava-book-refinement-task-4';
/**
 * @minItems 1
 * @maxItems 24
 */
export type SourceFeatures = [SourceFeatureRequest, ...SourceFeatureRequest[]];
/**
 * @maxItems 2
 */
export type AllowedRoles = ('paragraph' | 'quote')[];
export type NodeId1 = string;
export type Page2 = number;
/**
 * @minItems 1
 * @maxItems 3
 */
export type ReferenceIds = [string, ...string[]];
/**
 * @minItems 1
 * @maxItems 7
 */
export type RequestedFeatures = [
  (
    | 'paragraph_role'
    | 'family'
    | 'weight'
    | 'italic'
    | 'first_line_indent'
    | 'block_inset'
    | 'relative_size'
  ),
  ...(
    | 'paragraph_role'
    | 'family'
    | 'weight'
    | 'italic'
    | 'first_line_indent'
    | 'block_inset'
    | 'relative_size'
  )[],
];
export type SelectionReason =
  | 'isolated_prose'
  | 'declared_quote'
  | 'heading_comparison'
  | 'appearance_comparison';
export type SourceSha256 = string;
export type TaskId = string;

export interface SourceFeatureTask {
  crops: Crops;
  decision_ids: DecisionIds;
  edges: Edges;
  image: RecognitionImage;
  metadata_ids?: MetadataIds;
  nodes: Nodes;
  observation_sha256: ObservationSha256;
  pixels_per_point: PixelsPerPoint;
  profile_id: ProfileId;
  prompt_version: PromptVersion;
  response_schema_version: ResponseSchemaVersion;
  schema_version: SchemaVersion;
  source_features: SourceFeatures;
  source_sha256: SourceSha256;
  task_id: TaskId;
}
export interface SourceFeatureCrop {
  id: Id;
  image_box: ImageBox;
  node_id: NodeId;
  page: Page;
  part: Part;
  render_sha256: RenderSha256;
  request_node_id: RequestNodeId;
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
export interface SourceFeatureNode {
  body_reference_id: BodyReferenceId;
  candidate_original_kind?: CandidateOriginalKind;
  id: Id1;
  kind: Kind;
  observation_method: ObservationMethod;
  observed_chapter: ObservedChapter;
  observed_level: ObservedLevel;
  observed_role: ObservedRole;
  observed_style: Style | null;
  page: Page1;
  ranked_source?: RankedSource;
  source_box: Box;
  structure_candidate?: StructureCandidate;
  text_excerpt: TextExcerpt;
  text_length: TextLength;
  text_sha256: TextSha256;
}
export interface Style {
  align?: Align;
  background_color?: BackgroundColor;
  block_indent_em?: BlockIndentEm;
  bold?: Bold;
  color?: Color;
  decoration_color?: DecorationColor;
  family?: Family;
  id: Id2;
  indent_em?: IndentEm;
  italic?: Italic;
  line_height?: LineHeight;
  relative_size?: RelativeSize;
  small_caps?: SmallCaps;
  space_after_em?: SpaceAfterEm;
  space_before_em?: SpaceBeforeEm;
  strike_through?: StrikeThrough;
  underline?: Underline;
  vertical_align?: VerticalAlign;
}
export interface SourceFeatureRequest {
  allowed_roles: AllowedRoles;
  column_box: Box;
  node_id: NodeId1;
  page: Page2;
  reference_ids: ReferenceIds;
  requested_features: RequestedFeatures;
  selection_reason: SelectionReason;
  source_box: Box;
}
