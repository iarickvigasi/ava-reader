/* Generated from Python recognition models; do not edit. */

/**
 * @minItems 1
 * @maxItems 24
 */
export type Decisions = [RefinementDecision, ...RefinementDecision[]];
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
export type Align = ('start' | 'left' | 'right' | 'center' | 'justify') | null;
export type Bold = boolean | null;
export type Family = ('serif' | 'sans-serif' | 'monospace') | null;
export type Id = string;
export type IndentEm = number | null;
export type Italic = boolean | null;
export type LineHeight = number | null;
export type RelativeSize = number | null;
export type SmallCaps = boolean | null;
export type SpaceAfterEm = number | null;
export type SpaceBeforeEm = number | null;
export type VerticalAlign = ('baseline' | 'super' | 'sub') | null;
export type TextSha256 = string;
export type ImageSha256 = string;
export type EdgeId = string;
/**
 * @minItems 2
 * @maxItems 48
 */
export type EvidenceIds1 = [string, string, ...string[]];
export type Join = boolean;
/**
 * @maxItems 16
 */
export type Joins = RefinementJoin[];
export type ObservationSha256 = string;
export type SchemaVersion = 'ava-book-refinement-response-1';
export type SourceSha256 = string;
export type TaskId = string;
/**
 * @maxItems 100
 */
export type Unresolved = string[];
/**
 * @maxItems 32
 */
export type Refinements = BookRefinementResponse[];
export type Language = string;
export type RenderSha256 = string;
export type SchemaVersion1 = 'ava-recognition-response-2';
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
        cells: [[unknown, ...unknown[]], ...[unknown, ...unknown[]][]];
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
export type HeaderAxis = ('row' | 'column' | 'both') | null;
export type End = number;
export type NoteLabel = string | null;
export type Start = number;
export type TargetText = string | null;
export type Url = string | null;
/**
 * @maxItems 20000
 */
export type Spans = RecognitionSpan[];
export type Text = string;
/**
 * @maxItems 20
 */
export type Cells = RecognitionCell[][];
export type ChapterRole1 = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart1 = boolean;
export type ContinuesFromPrevious = boolean;
export type ContinuesToNext = boolean;
export type HeadingLevel1 = number | null;
/**
 * Unique within this response; s0001, s0002, ...
 */
export type Id1 = string;
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
export type Text1 = string;
/**
 * @maxItems 2000
 */
export type Segments = RecognitionSegment[];
export type SourceSha2561 = string;
export type TaskId1 = string;
/**
 * @maxItems 100
 */
export type Unresolved1 = string[];
/**
 * @maxItems 25000
 */
export type Responses = RecognitionResponse[];
export type SchemaVersion2 = 'ava-reconstruct-input-1';
export type SourceSha2562 = string;

export interface ReconstructionInput {
  refinements?: Refinements;
  responses: Responses;
  schema_version: SchemaVersion2;
  source_sha256: SourceSha2562;
}
export interface BookRefinementResponse {
  decisions: Decisions;
  image_sha256: ImageSha256;
  joins: Joins;
  observation_sha256: ObservationSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
  unresolved: Unresolved;
}
export interface RefinementDecision {
  chapter_role: ChapterRole;
  chapter_start: ChapterStart;
  evidence_ids: EvidenceIds;
  heading_level: HeadingLevel;
  node_id: NodeId;
  parent_id: ParentId;
  style: Style;
  text_sha256: TextSha256;
}
export interface Style {
  align?: Align;
  bold?: Bold;
  family?: Family;
  id: Id;
  indent_em?: IndentEm;
  italic?: Italic;
  line_height?: LineHeight;
  relative_size?: RelativeSize;
  small_caps?: SmallCaps;
  space_after_em?: SpaceAfterEm;
  space_before_em?: SpaceBeforeEm;
  vertical_align?: VerticalAlign;
}
export interface RefinementJoin {
  edge_id: EdgeId;
  evidence_ids: EvidenceIds1;
  join: Join;
}
export interface RecognitionResponse {
  language: Language;
  render_sha256: RenderSha256;
  schema_version: SchemaVersion1;
  segments: Segments;
  source_sha256: SourceSha2561;
  task_id: TaskId1;
  unresolved: Unresolved1;
}
export interface RecognitionSegment1 {
  alt?: Alt;
  box: RecognitionBox;
  cells?: Cells;
  chapter_role?: ChapterRole1;
  chapter_start?: ChapterStart1;
  continues_from_previous: ContinuesFromPrevious;
  continues_to_next: ContinuesToNext;
  heading_level?: HeadingLevel1;
  id: Id1;
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
  style: Style | null;
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
  box: RecognitionBox;
  header_axis: HeaderAxis;
  spans: Spans;
  style: Style | null;
  text: Text;
}
export interface RecognitionSpan {
  end: End;
  note_label: NoteLabel;
  start: Start;
  style: Style | null;
  target_text: TargetText;
  url: Url;
}
