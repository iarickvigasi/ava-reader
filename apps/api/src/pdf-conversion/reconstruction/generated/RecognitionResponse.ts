/* Generated from Python recognition models; do not edit. */

export type Language = string;
export type RenderSha256 = string;
export type SchemaVersion = 'ava-recognition-response-2';
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
export type After = string;
export type Before = string;
export type ExactText = string;
export type End = number | null;
export type NoteLabel = string | null;
export type Start = number | null;
export type Align = ('start' | 'left' | 'right' | 'center' | 'justify') | null;
export type BackgroundColor = string | null;
export type BlockIndentEm = number | null;
export type Bold = boolean | null;
export type Color = string | null;
export type DecorationColor = string | null;
export type Family = ('serif' | 'sans-serif' | 'monospace') | null;
export type Id = string;
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
export type Spans = RecognitionSpan[];
export type Text = string;
/**
 * @maxItems 20
 */
export type Cells = RecognitionCell[][];
export type ChapterRole = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart = boolean;
export type ContinuesFromPrevious = boolean;
export type ContinuesToNext = boolean;
export type HeadingLevel = number | null;
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
export type SourceSha256 = string;
export type TaskId = string;
/**
 * @maxItems 100
 */
export type Unresolved = string[];

export interface RecognitionResponse {
  language: Language;
  render_sha256: RenderSha256;
  schema_version: SchemaVersion;
  segments: Segments;
  source_sha256: SourceSha256;
  task_id: TaskId;
  unresolved: Unresolved;
}
export interface RecognitionSegment1 {
  alt?: Alt;
  box: RecognitionBox;
  cells?: Cells;
  chapter_role?: ChapterRole;
  chapter_start?: ChapterStart;
  continues_from_previous: ContinuesFromPrevious;
  continues_to_next: ContinuesToNext;
  heading_level?: HeadingLevel;
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
  box: RecognitionBox | null;
  column_span?: ColumnSpan;
  header_axis: HeaderAxis;
  row_span?: RowSpan;
  source_cell_id?: SourceCellId;
  spans: Spans;
  style: Style | null;
  text: Text;
}
export interface RecognitionSpan {
  anchor?: RecognitionTextAnchor | null;
  end?: End;
  note_label: NoteLabel;
  start?: Start;
  style: Style | null;
  target_text: TargetText;
  url: Url;
}
export interface RecognitionTextAnchor {
  after?: After;
  before?: Before;
  exact_text: ExactText;
}
export interface Style {
  align?: Align;
  background_color?: BackgroundColor;
  block_indent_em?: BlockIndentEm;
  bold?: Bold;
  color?: Color;
  decoration_color?: DecorationColor;
  family?: Family;
  id: Id;
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
