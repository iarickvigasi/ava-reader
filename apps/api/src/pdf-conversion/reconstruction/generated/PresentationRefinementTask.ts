/* Generated from Python recognition models; do not edit. */

/**
 * @minItems 1
 * @maxItems 48
 */
export type Crops = [RefinementCrop, ...RefinementCrop[]];
export type Id = string;
/**
 * @minItems 4
 * @maxItems 4
 */
export type ImageBox = [number, number, number, number];
export type NodeId = string;
export type Page = number;
export type Part = 'head' | 'tail';
export type RenderSha256 = string;
export type CoordinateSpace = 'page_points_top_left' | 'normalized_top_left';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
/**
 * @maxItems 24
 */
export type DecisionIds = string[];
export type Id1 = string;
export type NextId = string;
export type PreviousId = string;
/**
 * @maxItems 16
 */
export type Edges = RefinementEdge[];
export type Base64 = string;
export type ByteLength = number;
export type Height = number;
export type MediaType = 'image/png' | 'image/jpeg';
export type Sha256 = string;
export type Width = number;
/**
 * @minItems 1
 * @maxItems 16
 */
export type JoinCandidates = [UniformJoinCandidate, ...UniformJoinCandidate[]];
export type EdgeId = string;
export type Id2 = string;
export type NativeAlignmentFallback = boolean;
export type NativeId = string;
export type NextId1 = string;
export type Align = ('start' | 'left' | 'right' | 'center' | 'justify') | null;
export type BackgroundColor = string | null;
export type BlockIndentEm = number | null;
export type Bold = boolean | null;
export type Color = string | null;
export type DecorationColor = string | null;
export type Family = ('serif' | 'sans-serif' | 'monospace') | null;
export type Id3 = string;
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
export type NextStyleSha256 = string;
export type NextTextSha256 = string;
export type PreviousId1 = string;
export type PreviousStyleSha256 = string;
export type PreviousTextSha256 = string;
/**
 * @maxItems 24
 */
export type MetadataIds = string[];
/**
 * @maxItems 16
 */
export type NativeAlignmentFallbacks = string[];
/**
 * @minItems 1
 * @maxItems 16
 */
export type NativeEndpoints = [string, ...string[]];
/**
 * @minItems 1
 * @maxItems 256
 */
export type Nodes = [RefinementNode, ...RefinementNode[]];
export type BodyReferenceId = string | null;
export type CandidateOriginalKind =
  | ('paragraph' | 'list_item' | 'verse' | 'heading')
  | null;
export type ContextAfter = string;
export type ContextBefore = string;
export type Id4 = string;
export type Kind = 'heading' | 'paragraph';
export type ObservedChapter = boolean;
export type ObservedLevel = number | null;
export type ObservedRole = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type Page1 = number;
export type RankedSource = boolean;
export type StructureCandidate = boolean;
export type TextExcerpt = string;
export type TextSha256 = string;
export type ObservationSha256 = string;
export type PixelsPerPoint = 2;
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion = 'ava-book-refinement-8';
export type ResponseSchemaVersion = 'ava-book-refinement-response-5';
export type SchemaVersion = 'ava-book-refinement-task-5';
export type SourceSha256 = string;
export type TaskId = string;

export interface PresentationRefinementTask {
  crops: Crops;
  decision_ids: DecisionIds;
  edges: Edges;
  image: RecognitionImage;
  join_candidates: JoinCandidates;
  metadata_ids?: MetadataIds;
  native_alignment_fallbacks: NativeAlignmentFallbacks;
  native_endpoints: NativeEndpoints;
  nodes: Nodes;
  observation_sha256: ObservationSha256;
  pixels_per_point: PixelsPerPoint;
  profile_id: ProfileId;
  prompt_version: PromptVersion;
  response_schema_version: ResponseSchemaVersion;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
}
export interface RefinementCrop {
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
export interface RefinementEdge {
  id: Id1;
  next_id: NextId;
  previous_id: PreviousId;
}
export interface RecognitionImage {
  base64: Base64;
  byte_length: ByteLength;
  height: Height;
  media_type: MediaType;
  sha256: Sha256;
  width: Width;
}
export interface UniformJoinCandidate {
  edge_id: EdgeId;
  id: Id2;
  native_alignment_fallback: NativeAlignmentFallback;
  native_id: NativeId;
  next_id: NextId1;
  next_style: Style;
  next_style_sha256: NextStyleSha256;
  next_text_sha256: NextTextSha256;
  previous_id: PreviousId1;
  previous_style: Style;
  previous_style_sha256: PreviousStyleSha256;
  previous_text_sha256: PreviousTextSha256;
}
export interface Style {
  align?: Align;
  background_color?: BackgroundColor;
  block_indent_em?: BlockIndentEm;
  bold?: Bold;
  color?: Color;
  decoration_color?: DecorationColor;
  family?: Family;
  id: Id3;
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
export interface RefinementNode {
  body_reference_id: BodyReferenceId;
  candidate_original_kind?: CandidateOriginalKind;
  context_after?: ContextAfter;
  context_before?: ContextBefore;
  id: Id4;
  kind: Kind;
  observed_chapter: ObservedChapter;
  observed_level: ObservedLevel;
  observed_role: ObservedRole;
  observed_style: Style | null;
  page: Page1;
  ranked_source: RankedSource;
  structure_candidate?: StructureCandidate;
  text_excerpt: TextExcerpt;
  text_sha256: TextSha256;
}
