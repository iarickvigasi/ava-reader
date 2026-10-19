/* Generated from Python recognition models; do not edit. */

export type NativeSegmentCount = number;
export type ObservationSha256 = string;
export type PageNumber = number;
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type SchemaVersion = 'ava-prepare-result-4';
export type SourceLayoutPolicy = 'ava-native-layout-1';
export type SourceNormalizationPolicy = 'ava-native-word-wrap-1';
export type SourcePageCount = number;
export type SourceSha256 = string;
export type SourceStructurePolicy = 'ava-native-structure-1';
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
  | 'ava-prose-region-16'
  | 'ava-prose-region-17';
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
export type Id = string;
export type Kind = 'figure' | 'table' | 'aside';
export type SegmentSha256 = string;
/**
 * @maxItems 2000
 */
export type Artifacts = NativeStructureArtifact[];
export type Boundary = 'line' | 'column' | 'page';
export type CandidateId = string;
export type CandidateSha256 = string;
export type LeftLineId = string;
export type RightLineId = string;
export type Role = 'paragraph' | 'note' | 'list_item';
/**
 * @maxItems 10000
 */
export type Boundaries = NativeStructureBoundary[];
export type ExactText = string;
export type LineId = string;
export type SpanId = string;
/**
 * @maxItems 20000
 */
export type EligibleCallouts = NativeStructureCallout[];
/**
 * @minItems 1
 * @maxItems 10000
 */
export type Lines = [NativeStructureLine, ...NativeStructureLine[]];
export type Id1 = string;
export type End = number;
export type Id2 = string;
export type NoteLabel = string | null;
export type Start = number;
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
export type TargetText = string | null;
export type Url = string | null;
/**
 * @maxItems 20000
 */
export type Spans = NativeStructureSpan[];
export type Text = string;
export type TextSha256 = string;
export type ObservationSha2561 = string;
export type PageHeightPt1 = number;
export type PageNumber2 = number;
export type PageWidthPt1 = number;
export type ProfileId2 = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type PromptVersion1 = 'ava-native-structure-1';
export type Purpose1 = 'pdf_native_structure';
/**
 * @minItems 1
 * @maxItems 2000
 */
export type Regions = [NativeStructureRegion, ...NativeStructureRegion[]];
export type ArtifactId = string | null;
/**
 * @maxItems 10000
 */
export type LineIds = string[];
export type Band = number;
export type Column = 0 | 1 | 2;
export type Id4 = string;
export type Role1 = 'content' | 'cover' | 'furniture' | 'blank' | 'unsupported';
export type Route =
  | 'native'
  | 'ocr'
  | 'replay'
  | 'render'
  | 'blank'
  | 'unresolved';
export type ResponseSchemaVersion1 = 'ava-native-structure-response-1';
export type SchemaVersion2 = 'ava-native-structure-task-1';
export type SourceSha2562 = string;
export type TaskId1 = string;
/**
 * @maxItems 50
 */
export type Tasks = (RecognitionTask | NativeStructureTask)[];

export interface NativeWordWrapPrepareResult {
  native_segment_count: NativeSegmentCount;
  observation_sha256: ObservationSha256;
  page_number: PageNumber;
  profile_id?: ProfileId;
  schema_version: SchemaVersion;
  source_layout_policy: SourceLayoutPolicy;
  source_normalization_policy: SourceNormalizationPolicy;
  source_page_count: SourcePageCount;
  source_sha256: SourceSha256;
  source_structure_policy: SourceStructurePolicy;
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
export interface NativeStructureTask {
  artifacts: Artifacts;
  boundaries: Boundaries;
  eligible_callouts: EligibleCallouts;
  image: RecognitionImage;
  lines: Lines;
  observation_sha256: ObservationSha2561;
  page_height_pt: PageHeightPt1;
  page_number: PageNumber2;
  page_width_pt: PageWidthPt1;
  profile_id: ProfileId2;
  prompt_version: PromptVersion1;
  purpose: Purpose1;
  regions: Regions;
  response_schema_version: ResponseSchemaVersion1;
  schema_version: SchemaVersion2;
  source_sha256: SourceSha2562;
  task_id: TaskId1;
}
export interface NativeStructureArtifact {
  id: Id;
  kind: Kind;
  segment_sha256: SegmentSha256;
}
export interface NativeStructureBoundary {
  boundary: Boundary;
  candidate_id: CandidateId;
  candidate_sha256: CandidateSha256;
  left_line_id: LeftLineId;
  right_line_id: RightLineId;
  role: Role;
}
export interface NativeStructureCallout {
  box: Box;
  exact_text: ExactText;
  line_id: LineId;
  span_id: SpanId;
}
export interface NativeStructureLine {
  box: Box;
  id: Id1;
  spans: Spans;
  style: Style;
  text: Text;
  text_sha256: TextSha256;
}
export interface NativeStructureSpan {
  end: End;
  id: Id2;
  note_label?: NoteLabel;
  start: Start;
  style?: Style | null;
  target_text?: TargetText;
  url?: Url;
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
export interface NativeStructureRegion {
  artifact_id?: ArtifactId;
  line_ids: LineIds;
  source: SourceRegion;
}
export interface SourceRegion {
  band: Band;
  box: Box;
  column: Column;
  id: Id4;
  role: Role1;
  route: Route;
}
