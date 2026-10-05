/* Generated from Python recognition models; do not edit. */

export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type ChapterRole = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart = boolean | null;
/**
 * @minItems 1
 * @maxItems 48
 */
export type EvidenceIds = [string, ...string[]];
export type HeadingLevel = number | null;
export type NodeId = string;
export type ParentId = string | null;
export type RoleKind =
  | 'heading'
  | 'paragraph'
  | 'list_item'
  | 'verse'
  | 'quote';
export type Style = null;
export type TextSha256 = string;
export type ChapterRole1 = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart1 = boolean | null;
/**
 * @minItems 1
 * @maxItems 48
 */
export type EvidenceIds1 = [string, ...string[]];
export type HeadingLevel1 = number | null;
export type NodeId1 = string;
export type ParentId1 = string | null;
export type RoleKind1 = null;
export type Align = ('start' | 'left' | 'right' | 'center' | 'justify') | null;
export type BackgroundColor = string | null;
export type BlockIndentEm = number | null;
export type Bold = boolean;
export type Color = string | null;
export type DecorationColor = string | null;
export type Family = ('serif' | 'sans-serif' | 'monospace') | null;
export type Id = 'observed';
export type IndentEm = number | null;
export type Italic = boolean | null;
export type LineHeight = number | null;
export type RelativeSize = number;
export type SmallCaps = boolean | null;
export type SpaceAfterEm = number | null;
export type SpaceBeforeEm = number | null;
export type StrikeThrough = boolean | null;
export type Underline = boolean | null;
export type VerticalAlign = ('baseline' | 'super' | 'sub') | null;
export type TextSha2561 = string;
/**
 * @maxItems 24
 */
export type Decisions = (NativeRefinementDecision | OcrRefinementDecision)[];
export type ImageSha256 = string;
export type EdgeId = string;
/**
 * @minItems 2
 * @maxItems 48
 */
export type EvidenceIds2 = [string, string, ...string[]];
export type Join = boolean;
/**
 * @maxItems 16
 */
export type Joins = RefinementJoin[];
export type End = number | null;
/**
 * @minItems 1
 * @maxItems 48
 */
export type EvidenceIds3 = [string, ...string[]];
export type NodeId2 = string;
export type Role =
  | (
      | 'author'
      | 'translator'
      | 'editor'
      | 'illustrator'
      | 'subtitle'
      | 'publisher'
    )
  | null;
export type Start = number | null;
export type TextSha2562 = string;
/**
 * @maxItems 24
 */
export type MetadataDecisions = BibliographicDecision[];
export type ObservationSha256 = string;
export type SchemaVersion = 'ava-book-refinement-response-3';
export type SourceSha256 = string;
export type TaskId = string;
/**
 * @maxItems 100
 */
export type Unresolved = string[];
/**
 * @maxItems 0
 */
export type Decisions1 = [];
/**
 * @minItems 1
 * @maxItems 24
 */
export type FeatureDecisions = [
  SourceFeatureDecision,
  ...SourceFeatureDecision[],
];
/**
 * @minItems 1
 * @maxItems 7
 */
export type Features = [
  SourceFeatureObservation,
  ...SourceFeatureObservation[],
];
export type Disposition = 'observed' | 'unknown' | 'not_applicable';
/**
 * @minItems 1
 * @maxItems 4
 */
export type EvidenceIds4 = [string, ...string[]];
export type Feature =
  | 'paragraph_role'
  | 'family'
  | 'weight'
  | 'italic'
  | 'first_line_indent'
  | 'block_inset'
  | 'relative_size';
export type Reason =
  | (
      | 'source_blurred'
      | 'source_clipped'
      | 'source_context_insufficient'
      | 'heading_has_no_prose_first_line'
    )
  | null;
export type Value =
  | ('paragraph' | 'quote' | 'serif' | 'sans-serif' | 'monospace')
  | boolean
  | number
  | null;
export type NodeId3 = string;
export type TextSha2563 = string;
export type ImageSha2561 = string;
/**
 * @maxItems 0
 */
export type Joins1 = [];
/**
 * @maxItems 0
 */
export type MetadataDecisions1 = [];
export type ObservationSha2561 = string;
export type SchemaVersion1 = 'ava-book-refinement-response-4';
export type SourceSha2561 = string;
export type TaskId1 = string;
/**
 * @maxItems 100
 */
export type Unresolved1 = string[];
/**
 * @maxItems 32
 */
export type Refinements = (BookRefinementResponse | SourceFeatureResponse)[];
export type Language = string;
export type RenderSha256 = string;
export type SchemaVersion2 = 'ava-recognition-response-2';
export type RecognitionSegment = RecognitionSegment1 &
  (
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        heading_level: number;
        kind?: 'heading';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'note';
        note_label: string;
        note_role: 'footnote' | 'endnote';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'list_item';
        list_depth: number;
        list_ordered: boolean;
      }
    | {
        /**
         * @minItems 1
         */
        cells: [unknown[], ...unknown[][]];
        kind?: 'table';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'paragraph';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'quote';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'aside';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'caption';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'credit';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'verse';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'code';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'figure';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'separator';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'furniture';
      }
    | {
        /**
         * @maxItems 0
         */
        cells?: [];
        kind?: 'unsupported';
      }
  ) &
  (
    | {
        chapter_start?: false;
      }
    | {
        chapter_role: 'frontmatter' | 'bodymatter' | 'backmatter';
        chapter_start: true;
        heading_level: 1;
        kind?: 'heading';
      }
  ) &
  (
    | {
        list_ordered?: null | false;
      }
    | {
        kind?: 'list_item';
        list_ordered: true;
        list_start: number;
      }
  );
export type Alt = string;
export type CoordinateSpace = 'render_normalized_1000';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type ColumnSpan = number;
export type HeaderAxis = ('row' | 'column' | 'both') | null;
export type RowSpan = number;
export type SourceCellId = string | null;
/**
 * Exact immediately adjacent following context in the same finalized text, including Unicode and spaces. Empty means no following-context constraint.
 */
export type After = string;
/**
 * Exact immediately adjacent preceding context in the same finalized text, including Unicode and spaces. Empty means no preceding-context constraint.
 */
export type Before = string;
/**
 * Copy verbatim from the finalized owning segment/cell text. Unicode scalars, case and spaces must be identical; an ordinary digit cannot anchor a Unicode script digit. Together with before/after, this quotation must identify exactly one occurrence.
 */
export type ExactText = string;
export type End1 = number | null;
export type NoteLabel = string | null;
export type Start1 = number | null;
export type Align1 = ('start' | 'left' | 'right' | 'center' | 'justify') | null;
export type BackgroundColor1 = string | null;
export type BlockIndentEm1 = number | null;
export type Bold1 = boolean | null;
export type Color1 = string | null;
export type DecorationColor1 = string | null;
export type Family1 = ('serif' | 'sans-serif' | 'monospace') | null;
export type Id1 = string;
export type IndentEm1 = number | null;
export type Italic1 = boolean | null;
export type LineHeight1 = number | null;
export type RelativeSize1 = number | null;
export type SmallCaps1 = boolean | null;
export type SpaceAfterEm1 = number | null;
export type SpaceBeforeEm1 = number | null;
export type StrikeThrough1 = boolean | null;
export type Underline1 = boolean | null;
export type VerticalAlign1 = ('baseline' | 'super' | 'sub') | null;
export type TargetText = string | null;
export type Url = string | null;
/**
 * @maxItems 20000
 */
export type Spans = RecognitionSpan[];
/**
 * Finalize this cell's exact source transcription before quoting any span. Characters and placement are separate: ordinary raised/lowered digits use ordinary text plus vertical_align; intrinsic Unicode stays exact. Every anchor/context quotes this text.
 */
export type Text = string;
/**
 * @maxItems 20
 */
export type Cells = RecognitionCell[][];
export type ChapterRole2 = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart2 = boolean;
export type ContinuesFromPrevious = boolean;
export type ContinuesToNext = boolean;
export type HeadingLevel2 = number | null;
/**
 * Unique within this response; s0001, s0002, ...
 */
export type Id2 = string;
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
export type ListDepth = number | null;
export type ListOrdered = boolean | null;
export type ListStart = number | null;
export type Method = 'ocr';
export type NoteLabel1 = string | null;
export type NoteRole = ('footnote' | 'endnote') | null;
export type Page = number;
export type RelatedTo = string | null;
/**
 * @maxItems 20000
 */
export type Spans1 = RecognitionSpan[];
/**
 * Finalize this segment's exact source transcription before quoting any span. Characters and placement are separate: ordinary raised/lowered digits use ordinary text plus vertical_align; intrinsic Unicode stays exact. Every anchor/context quotes this text.
 */
export type Text1 = string;
/**
 * @maxItems 2000
 */
export type Segments = RecognitionSegment[];
export type SourceSha2562 = string;
export type TaskId2 = string;
/**
 * @maxItems 100
 */
export type Unresolved2 = string[];
/**
 * @maxItems 25000
 */
export type Responses = RecognitionResponse[];
export type SchemaVersion3 = 'ava-reconstruct-input-1';
export type SourceFeaturePolicy = 'ava-ocr-source-features-1' | null;
export type SourceSha2563 = string;

export interface ReconstructionInput {
  profile_id?: ProfileId;
  refinements?: Refinements;
  responses: Responses;
  schema_version: SchemaVersion3;
  source_feature_policy?: SourceFeaturePolicy;
  source_sha256: SourceSha2563;
}
export interface BookRefinementResponse {
  decisions: Decisions;
  image_sha256: ImageSha256;
  joins: Joins;
  metadata_decisions?: MetadataDecisions;
  observation_sha256: ObservationSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
  unresolved: Unresolved;
}
export interface NativeRefinementDecision {
  chapter_role: ChapterRole;
  chapter_start: ChapterStart;
  evidence_ids: EvidenceIds;
  heading_level: HeadingLevel;
  node_id: NodeId;
  parent_id: ParentId;
  role_kind: RoleKind;
  style: Style;
  text_sha256: TextSha256;
}
export interface OcrRefinementDecision {
  chapter_role: ChapterRole1;
  chapter_start: ChapterStart1;
  evidence_ids: EvidenceIds1;
  heading_level: HeadingLevel1;
  node_id: NodeId1;
  parent_id: ParentId1;
  role_kind?: RoleKind1;
  style: RefinementStyle;
  text_sha256: TextSha2561;
}
/**
 * Sparse source typography with the wire observations required by acceptance.
 */
export interface RefinementStyle {
  align?: Align;
  background_color?: BackgroundColor;
  block_indent_em?: BlockIndentEm;
  bold: Bold;
  color?: Color;
  decoration_color?: DecorationColor;
  family?: Family;
  id: Id;
  indent_em?: IndentEm;
  italic?: Italic;
  line_height?: LineHeight;
  relative_size: RelativeSize;
  small_caps?: SmallCaps;
  space_after_em?: SpaceAfterEm;
  space_before_em?: SpaceBeforeEm;
  strike_through?: StrikeThrough;
  underline?: Underline;
  vertical_align?: VerticalAlign;
}
export interface RefinementJoin {
  edge_id: EdgeId;
  evidence_ids: EvidenceIds2;
  join: Join;
}
export interface BibliographicDecision {
  end?: End;
  evidence_ids: EvidenceIds3;
  node_id: NodeId2;
  role: Role;
  start?: Start;
  text_sha256: TextSha2562;
}
export interface SourceFeatureResponse {
  decisions: Decisions1;
  feature_decisions: FeatureDecisions;
  image_sha256: ImageSha2561;
  joins: Joins1;
  metadata_decisions?: MetadataDecisions1;
  observation_sha256: ObservationSha2561;
  schema_version: SchemaVersion1;
  source_sha256: SourceSha2561;
  task_id: TaskId1;
  unresolved: Unresolved1;
}
export interface SourceFeatureDecision {
  features: Features;
  node_id: NodeId3;
  text_sha256: TextSha2563;
}
export interface SourceFeatureObservation {
  disposition: Disposition;
  evidence_ids: EvidenceIds4;
  feature: Feature;
  reason: Reason;
  value: Value;
}
export interface RecognitionResponse {
  language: Language;
  render_sha256: RenderSha256;
  schema_version: SchemaVersion2;
  segments: Segments;
  source_sha256: SourceSha2562;
  task_id: TaskId2;
  unresolved: Unresolved2;
}
export interface RecognitionSegment1 {
  alt?: Alt;
  box: RecognitionBox;
  cells?: Cells;
  chapter_role?: ChapterRole2;
  chapter_start?: ChapterStart2;
  continues_from_previous: ContinuesFromPrevious;
  continues_to_next: ContinuesToNext;
  heading_level?: HeadingLevel2;
  id: Id2;
  kind: Kind;
  list_depth?: ListDepth;
  list_ordered?: ListOrdered;
  list_start?: ListStart;
  method: Method;
  note_label?: NoteLabel1;
  note_role?: NoteRole;
  page: Page;
  related_to?: RelatedTo;
  spans: Spans1;
  style: Style1 | null;
  text: Text1;
}
export interface RecognitionBox {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
export interface RecognitionCell {
  box: RecognitionBox | null;
  column_span?: ColumnSpan;
  header_axis: HeaderAxis;
  row_span?: RowSpan;
  source_cell_id?: SourceCellId;
  spans: Spans;
  style: Style1 | null;
  text: Text;
}
export interface RecognitionSpan {
  anchor?: RecognitionTextAnchor | null;
  end?: End1;
  note_label: NoteLabel;
  start?: Start1;
  style: Style1 | null;
  target_text: TargetText;
  url: Url;
}
export interface RecognitionTextAnchor {
  after?: After;
  before?: Before;
  exact_text: ExactText;
}
export interface Style1 {
  align?: Align1;
  background_color?: BackgroundColor1;
  block_indent_em?: BlockIndentEm1;
  bold?: Bold1;
  color?: Color1;
  decoration_color?: DecorationColor1;
  family?: Family1;
  id: Id1;
  indent_em?: IndentEm1;
  italic?: Italic1;
  line_height?: LineHeight1;
  relative_size?: RelativeSize1;
  small_caps?: SmallCaps1;
  space_after_em?: SpaceAfterEm1;
  space_before_em?: SpaceBeforeEm1;
  strike_through?: StrikeThrough1;
  underline?: Underline1;
  vertical_align?: VerticalAlign1;
}
