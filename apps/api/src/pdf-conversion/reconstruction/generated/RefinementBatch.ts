/* Generated from Python recognition models; do not edit. */

export type SchemaVersion = 'ava-book-refinement-batch-1';
export type SourceSha256 = string;
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
 * @maxItems 24
 */
export type MetadataIds = string[];
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
export type Id2 = string;
export type Kind = 'heading' | 'paragraph';
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
export type Page1 = number;
export type RankedSource = boolean;
export type StructureCandidate = boolean;
export type TextExcerpt = string;
export type TextSha256 = string;
export type ObservationSha256 = string;
export type PixelsPerPoint = 2;
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion =
  | 'ava-book-refinement-3'
  | 'ava-book-refinement-4'
  | 'ava-book-refinement-5'
  | 'ava-book-refinement-6';
export type ResponseSchemaVersion = 'ava-book-refinement-response-3';
export type SchemaVersion1 = 'ava-book-refinement-task-3';
export type SourceSha2561 = string;
export type TaskId = string;
/**
 * @minItems 1
 * @maxItems 48
 */
export type Crops1 = [SourceFeatureCrop, ...SourceFeatureCrop[]];
export type Id4 = string;
/**
 * @minItems 4
 * @maxItems 4
 */
export type ImageBox1 = [number, number, number, number];
export type NodeId1 = string;
export type Page2 = number;
export type Part1 = 'context';
export type RenderSha2561 = string;
export type RequestNodeId = string;
/**
 * @maxItems 0
 */
export type DecisionIds1 = [];
/**
 * @maxItems 0
 */
export type Edges1 = [];
/**
 * @maxItems 0
 */
export type MetadataIds1 = [];
/**
 * @minItems 1
 * @maxItems 256
 */
export type Nodes1 = [SourceFeatureNode, ...SourceFeatureNode[]];
export type BodyReferenceId1 = string | null;
export type CandidateOriginalKind1 = null;
export type Id5 = string;
export type Kind1 = 'heading' | 'paragraph' | 'quote';
export type ObservationMethod = 'native' | 'ocr' | 'render';
export type ObservedChapter1 = boolean;
export type ObservedLevel1 = number | null;
export type ObservedRole1 =
  | ('frontmatter' | 'bodymatter' | 'backmatter')
  | null;
export type Page3 = number;
export type RankedSource1 = true;
export type StructureCandidate1 = false;
export type TextExcerpt1 = string;
export type TextLength = number;
export type TextSha2561 = string;
export type ObservationSha2561 = string;
export type PixelsPerPoint1 = 2;
export type ProfileId1 = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion1 = 'ava-book-refinement-7';
export type ResponseSchemaVersion1 = 'ava-book-refinement-response-4';
export type SchemaVersion2 = 'ava-book-refinement-task-4';
/**
 * @minItems 1
 * @maxItems 24
 */
export type SourceFeatures = [SourceFeatureRequest, ...SourceFeatureRequest[]];
/**
 * @maxItems 2
 */
export type AllowedRoles = ('paragraph' | 'quote')[];
export type NodeId2 = string;
export type Page4 = number;
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
export type SourceSha2562 = string;
export type TaskId1 = string;
/**
 * @maxItems 32
 */
export type Tasks = (BookRefinementTask | SourceFeatureTask)[];

export interface RefinementBatch {
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  tasks: Tasks;
}
export interface BookRefinementTask {
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
  schema_version: SchemaVersion1;
  source_sha256: SourceSha2561;
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
export interface RefinementNode {
  body_reference_id: BodyReferenceId;
  candidate_original_kind?: CandidateOriginalKind;
  context_after?: ContextAfter;
  context_before?: ContextBefore;
  id: Id2;
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
export interface SourceFeatureTask {
  crops: Crops1;
  decision_ids: DecisionIds1;
  edges: Edges1;
  image: RecognitionImage;
  metadata_ids?: MetadataIds1;
  nodes: Nodes1;
  observation_sha256: ObservationSha2561;
  pixels_per_point: PixelsPerPoint1;
  profile_id: ProfileId1;
  prompt_version: PromptVersion1;
  response_schema_version: ResponseSchemaVersion1;
  schema_version: SchemaVersion2;
  source_features: SourceFeatures;
  source_sha256: SourceSha2562;
  task_id: TaskId1;
}
export interface SourceFeatureCrop {
  id: Id4;
  image_box: ImageBox1;
  node_id: NodeId1;
  page: Page2;
  part: Part1;
  render_sha256: RenderSha2561;
  request_node_id: RequestNodeId;
  source_box: Box;
}
export interface SourceFeatureNode {
  body_reference_id: BodyReferenceId1;
  candidate_original_kind?: CandidateOriginalKind1;
  id: Id5;
  kind: Kind1;
  observation_method: ObservationMethod;
  observed_chapter: ObservedChapter1;
  observed_level: ObservedLevel1;
  observed_role: ObservedRole1;
  observed_style: Style | null;
  page: Page3;
  ranked_source?: RankedSource1;
  source_box: Box;
  structure_candidate?: StructureCandidate1;
  text_excerpt: TextExcerpt1;
  text_length: TextLength;
  text_sha256: TextSha2561;
}
export interface SourceFeatureRequest {
  allowed_roles: AllowedRoles;
  column_box: Box;
  node_id: NodeId2;
  page: Page4;
  reference_ids: ReferenceIds;
  requested_features: RequestedFeatures;
  selection_reason: SelectionReason;
  source_box: Box;
}
