/* Generated from worker JSON Schema; do not edit. */

/**
 * @minItems 1
 * @maxItems 100000
 */
export type Addresses = [Address, ...Address[]];
export type Fragment = string;
export type ResourcePath = string;
export type BlockId = string;
export type ChapterId = string;
export type Kind = 'internal';
export type Offset = number;
/**
 * @minItems 1
 * @maxItems 20000
 */
export type Blocks = [
  (
    | ProseBlock
    | HeadingBlock
    | NoteBlock
    | ListItemBlock
    | FigureBlock
    | SeparatorBlock
    | TableBlock
  ),
  ...(
    | ProseBlock
    | HeadingBlock
    | NoteBlock
    | ListItemBlock
    | FigureBlock
    | SeparatorBlock
    | TableBlock
  )[],
];
/**
 * @minItems 1
 * @maxItems 200001
 */
export type CodepointUtf16 = [number, ...number[]];
export type CanonicalEnd = number;
export type CanonicalStart = number;
export type Kind1 = 'identity' | 'nfc' | 'ligature' | 'line_wrap';
export type SourceEnd = number;
export type SourceStart = number;
/**
 * @maxItems 200000
 */
export type Segments = NormalizationSegment[];
export type SourceSha256 = string;
export type SourceText = string;
export type Sha256 = string;
export type End = number;
export type Id = string;
export type Link = (InternalTarget | NoteTarget | ExternalTarget) | null;
export type BlockId1 = string;
export type ChapterId1 = string;
export type Kind2 = 'note';
export type Offset1 = 0;
export type Kind3 = 'external';
export type Url = string;
export type Start = number;
export type StyleId = string | null;
/**
 * @maxItems 20000
 */
export type Spans = InlineSpan[];
export type Text = string;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence = [Evidence1, ...Evidence1[]];
export type CoordinateSpace = 'page_points_top_left' | 'normalized_top_left';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type Method = 'native' | 'ocr' | 'review' | 'replay' | 'render';
export type Page = number;
export type RegionId = string;
export type Id1 = string;
export type Kind4 =
  | 'paragraph'
  | 'quote'
  | 'aside'
  | 'caption'
  | 'credit'
  | 'verse'
  | 'code';
export type StyleId1 = string | null;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence2 = [Evidence1, ...Evidence1[]];
export type Id2 = string;
export type Kind5 = 'heading';
export type Level = number;
export type StyleId2 = string | null;
/**
 * @minItems 1
 * @maxItems 20000
 */
export type CalloutIds = [string, ...string[]];
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence3 = [Evidence1, ...Evidence1[]];
export type Id3 = string;
export type Kind6 = 'note';
export type Label = string;
export type NoteRole = 'footnote' | 'endnote';
export type StyleId3 = string | null;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence4 = [Evidence1, ...Evidence1[]];
export type Id4 = string;
export type Kind7 = 'list_item';
export type ListId = string;
export type StyleId4 = string | null;
export type Alt = string;
export type CaptionId = string | null;
export type CreditId = string | null;
export type Decorative = boolean;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence5 = [Evidence1, ...Evidence1[]];
export type Id5 = string;
export type Kind8 = 'figure';
export type ResourceId = string;
export type StyleId5 = string | null;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence6 = [Evidence1, ...Evidence1[]];
export type Id6 = string;
export type Kind9 = 'separator';
export type StyleId6 = string | null;
export type CaptionId1 = string | null;
/**
 * @minItems 1
 * @maxItems 160
 */
export type Cells = [TableCell, ...TableCell[]];
export type Column = number;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence7 = [Evidence1, ...Evidence1[]];
export type HeaderAxis = ('row' | 'column' | 'both') | null;
/**
 * @maxItems 28
 */
export type HeaderIds = string[];
export type Id7 = string;
export type Row = number;
export type StyleId7 = string | null;
export type ColumnCount = number;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence8 = [Evidence1, ...Evidence1[]];
export type Id8 = string;
export type Kind10 = 'table';
export type RowCount = number;
export type StyleId8 = string | null;
/**
 * @minItems 1
 * @maxItems 20000
 */
export type Chapters = [Chapter, ...Chapter[]];
/**
 * @minItems 1
 * @maxItems 20000
 */
export type BlockIds = [string, ...string[]];
export type Id9 = string;
/**
 * @minItems 1
 * @maxItems 128
 */
export type ResourcePaths = [string, ...string[]];
export type Role = 'frontmatter' | 'bodymatter' | 'backmatter';
export type Title = string;
export type CoverResourceId = string | null;
export type DocumentId = string;
export type Depth = number;
export type Id10 = string;
/**
 * @minItems 1
 * @maxItems 20000
 */
export type ItemIds = [string, ...string[]];
export type MarkerStyle =
  | (
      | 'decimal'
      | 'lower-alpha'
      | 'upper-alpha'
      | 'lower-roman'
      | 'upper-roman'
      | 'bullet'
    )
  | null;
export type Ordered = boolean;
export type ParentItemId = string | null;
export type Start1 = number | null;
/**
 * @maxItems 10000
 */
export type Lists = ListGroup[];
export type ContributorRole =
  | ('author' | 'editor' | 'translator' | 'illustrator' | 'other')
  | null;
/**
 * @maxItems 500
 */
export type Evidence9 = Evidence1[];
export type Field =
  | 'title'
  | 'subtitle'
  | 'contributor'
  | 'publisher'
  | 'date'
  | 'language'
  | 'identifier'
  | 'rights'
  | 'edition'
  | 'description'
  | 'subject';
export type Id11 = string;
export type IdentifierScheme = ('isbn' | 'uuid' | 'uri' | 'other') | null;
export type Origin = 'source' | 'user' | 'generated';
export type Scope = 'work' | 'source_edition' | 'conversion';
export type Status = 'accepted' | 'candidate' | 'conflict' | 'unknown';
export type Value = string | null;
/**
 * @maxItems 1000
 */
export type Metadata = MetadataClaim[];
/**
 * @minItems 1
 * @maxItems 500
 */
export type Pages = [SourcePage, ...SourcePage[]];
export type HeightPt = number;
export type Label1 = string | null;
export type Number = number;
export type OriginalRotation = 0 | 90 | 180 | 270;
/**
 * @minItems 1
 * @maxItems 2000
 */
export type Regions = [SourceRegion, ...SourceRegion[]];
export type Band = number;
export type Column1 = 0 | 1 | 2;
export type Id12 = string;
export type Role1 = 'content' | 'furniture' | 'blank' | 'unsupported';
export type Route =
  | 'native'
  | 'ocr'
  | 'replay'
  | 'render'
  | 'blank'
  | 'unresolved';
export type WidthPt = number;
export type ProfileId = 'ava-pdf-prose-en-v2';
export type ByteLength = number;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence10 = [Evidence1, ...Evidence1[]];
export type Height = number;
export type Id13 = string;
export type MediaType = 'image/png' | 'image/jpeg';
export type Path = string;
export type Sha2561 = string;
export type Width = number;
/**
 * @maxItems 1000
 */
export type Resources = ImageResource[];
export type SchemaVersion = 'ava-book-2';
export type ByteLength1 = number;
export type PageCount = number;
export type Sha2562 = string;
/**
 * @minItems 1
 * @maxItems 20000
 */
export type Spine = [string, ...string[]];
export type Align = ('start' | 'left' | 'right' | 'center' | 'justify') | null;
export type Bold = boolean | null;
export type Family = ('serif' | 'sans-serif' | 'monospace') | null;
export type Id14 = string;
export type IndentEm = number | null;
export type Italic = boolean | null;
export type LineHeight = number | null;
export type RelativeSize = number | null;
export type SmallCaps = boolean | null;
export type SpaceAfterEm = number | null;
export type SpaceBeforeEm = number | null;
export type VerticalAlign = ('baseline' | 'super' | 'sub') | null;
/**
 * @maxItems 5000
 */
export type Styles = Style[];
/**
 * @minItems 1
 * @maxItems 20000
 */
export type Toc = [TocEntry, ...TocEntry[]];
export type Id15 = string;
export type Label2 = string;
export type ParentId = string | null;
export type CanonicalHashAlgorithm = 'ava-json-v1';
export type CanonicalSha256 = string;
export type FinalContentId = string;
/**
 * @minItems 1
 * @maxItems 8
 */
export type RequiredCapabilities = [
  (
    | 'text'
    | 'styles'
    | 'links'
    | 'notes'
    | 'figures'
    | 'tables'
    | 'lists'
    | 'literal-text'
  ),
  ...(
    | 'text'
    | 'styles'
    | 'links'
    | 'notes'
    | 'figures'
    | 'tables'
    | 'lists'
    | 'literal-text'
  )[],
];
export type SchemaVersion1 = 'ava-reader-3';
export type Version = 3;

export interface ReaderPackageV3 {
  book: CanonicalBookV2;
  canonical_hash_algorithm: CanonicalHashAlgorithm;
  canonical_sha256: CanonicalSha256;
  final_content_id: FinalContentId;
  required_capabilities: RequiredCapabilities;
  schema_version: SchemaVersion1;
  version: Version;
}
export interface CanonicalBookV2 {
  addresses: Addresses;
  blocks: Blocks;
  chapters: Chapters;
  cover_resource_id?: CoverResourceId;
  document_id: DocumentId;
  lists: Lists;
  metadata: Metadata;
  pages: Pages;
  profile_id: ProfileId;
  resources: Resources;
  schema_version: SchemaVersion;
  source: SourcePdf;
  spine: Spine;
  styles: Styles;
  toc: Toc;
}
export interface Address {
  fragment: Fragment;
  resource_path: ResourcePath;
  target: InternalTarget;
}
export interface InternalTarget {
  block_id: BlockId;
  chapter_id: ChapterId;
  kind: Kind;
  offset: Offset;
}
export interface ProseBlock {
  content: TextValue;
  evidence: Evidence;
  id: Id1;
  kind: Kind4;
  style_id?: StyleId1;
}
export interface TextValue {
  codepoint_utf16: CodepointUtf16;
  normalization?: NormalizationMap | null;
  sha256: Sha256;
  spans?: Spans;
  text: Text;
}
export interface NormalizationMap {
  segments: Segments;
  source_sha256: SourceSha256;
  source_text: SourceText;
}
export interface NormalizationSegment {
  canonical_end: CanonicalEnd;
  canonical_start: CanonicalStart;
  kind: Kind1;
  source_end: SourceEnd;
  source_start: SourceStart;
}
export interface InlineSpan {
  end: End;
  id: Id;
  link?: Link;
  start: Start;
  style_id?: StyleId;
}
export interface NoteTarget {
  block_id: BlockId1;
  chapter_id: ChapterId1;
  kind: Kind2;
  offset: Offset1;
}
export interface ExternalTarget {
  kind: Kind3;
  url: Url;
}
export interface Evidence1 {
  box: Box;
  method: Method;
  page: Page;
  region_id: RegionId;
}
export interface Box {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
export interface HeadingBlock {
  content: TextValue;
  evidence: Evidence2;
  id: Id2;
  kind: Kind5;
  level: Level;
  style_id?: StyleId2;
}
export interface NoteBlock {
  callout_ids: CalloutIds;
  content: TextValue;
  evidence: Evidence3;
  id: Id3;
  kind: Kind6;
  label: Label;
  note_role: NoteRole;
  style_id?: StyleId3;
}
export interface ListItemBlock {
  content: TextValue;
  evidence: Evidence4;
  id: Id4;
  kind: Kind7;
  list_id: ListId;
  style_id?: StyleId4;
}
export interface FigureBlock {
  alt: Alt;
  caption_id?: CaptionId;
  credit_id?: CreditId;
  decorative: Decorative;
  evidence: Evidence5;
  id: Id5;
  kind: Kind8;
  resource_id: ResourceId;
  style_id?: StyleId5;
}
export interface SeparatorBlock {
  evidence: Evidence6;
  id: Id6;
  kind: Kind9;
  style_id?: StyleId6;
}
export interface TableBlock {
  caption_id?: CaptionId1;
  cells: Cells;
  column_count: ColumnCount;
  evidence: Evidence8;
  id: Id8;
  kind: Kind10;
  row_count: RowCount;
  style_id?: StyleId8;
}
export interface TableCell {
  column: Column;
  content: TextValue;
  evidence: Evidence7;
  header_axis?: HeaderAxis;
  header_ids?: HeaderIds;
  id: Id7;
  row: Row;
  style_id?: StyleId7;
}
export interface Chapter {
  block_ids: BlockIds;
  id: Id9;
  resource_paths: ResourcePaths;
  role: Role;
  title: Title;
}
export interface ListGroup {
  depth: Depth;
  id: Id10;
  item_ids: ItemIds;
  marker_style?: MarkerStyle;
  ordered: Ordered;
  parent_item_id?: ParentItemId;
  start?: Start1;
}
export interface MetadataClaim {
  contributor_role?: ContributorRole;
  evidence?: Evidence9;
  field: Field;
  id: Id11;
  identifier_scheme?: IdentifierScheme;
  origin: Origin;
  scope: Scope;
  status: Status;
  value?: Value;
}
export interface SourcePage {
  height_pt: HeightPt;
  label?: Label1;
  number: Number;
  original_rotation: OriginalRotation;
  regions: Regions;
  width_pt: WidthPt;
}
export interface SourceRegion {
  band: Band;
  box: Box;
  column: Column1;
  id: Id12;
  role: Role1;
  route: Route;
}
export interface ImageResource {
  byte_length: ByteLength;
  evidence: Evidence10;
  height: Height;
  id: Id13;
  media_type: MediaType;
  path: Path;
  sha256: Sha2561;
  width: Width;
}
export interface SourcePdf {
  byte_length: ByteLength1;
  page_count: PageCount;
  sha256: Sha2562;
}
export interface Style {
  align?: Align;
  bold?: Bold;
  family?: Family;
  id: Id14;
  indent_em?: IndentEm;
  italic?: Italic;
  line_height?: LineHeight;
  relative_size?: RelativeSize;
  small_caps?: SmallCaps;
  space_after_em?: SpaceAfterEm;
  space_before_em?: SpaceBeforeEm;
  vertical_align?: VerticalAlign;
}
export interface TocEntry {
  id: Id15;
  label: Label2;
  parent_id?: ParentId;
  target: InternalTarget;
}
