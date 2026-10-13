/* Generated from worker JSON Schema; do not edit. */

/**
 * @minItems 1
 * @maxItems 100000
 */
export type Addresses = [Address, ...Address[]];
export type Fragment = string;
export type ResourcePath = string;
export type SourcePage = number | null;
export type BlockId = string;
export type ChapterId = string;
export type Kind = "internal";
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
export type Language = ("en" | "uk" | "und") | null;
export type Normalization =
  | NormalizationMap
  | LayoutNormalizationMap
  | LayoutNormalizationMapV3
  | null;
export type CanonicalEnd = number;
export type CanonicalStart = number;
export type Kind1 = "identity" | "nfc" | "ligature" | "line_wrap";
export type SourceEnd = number;
export type SourceStart = number;
/**
 * @maxItems 200000
 */
export type Segments = NormalizationSegment[];
export type SourceSha256 = string;
export type SourceText = string;
/**
 * @minItems 1
 * @maxItems 10000
 */
export type Candidates = [LayoutHyphenCandidate, ...LayoutHyphenCandidate[]];
export type Boundary = "line" | "column" | "page";
export type Consecutive = true;
export type Id = string;
export type CoordinateSpace = "page_points_top_left" | "normalized_top_left";
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type LineId = string;
export type Method = "native" | "ocr";
export type Page = number;
export type RegionId = string;
export type SourceEnd1 = number;
export type SourceStart1 = number;
export type PreserveLineBreaks = false;
export type Role = "paragraph" | "note" | "list_item";
export type SchemaVersion = "ava-layout-hyphen-candidate-1";
export type SourceEnd2 = number;
export type SourceSha2561 = string;
export type SourceStart2 = number;
export type SourceTextSha256 = string;
export type CandidateId = string;
export type CandidateSha256 = string;
export type Disposition = "layout" | "literal" | "unresolved";
export type SourceOffset = number;
export type SourceText1 = string;
/**
 * @maxItems 10000
 */
export type Derivations = LayoutHyphenDerivation[];
/**
 * @minItems 1
 * @maxItems 10000
 */
export type Dispositions = [
  LayoutHyphenDisposition,
  ...LayoutHyphenDisposition[],
];
export type SchemaVersion1 = "ava-source-normalization-2";
export type CandidateId1 = string | null;
export type CanonicalEnd1 = number;
export type CanonicalStart1 = number;
export type Kind2 =
  | "identity"
  | "nfc"
  | "ligature"
  | "line_wrap"
  | "layout_hyphen";
export type SourceEnd3 = number;
export type SourceStart3 = number;
/**
 * @maxItems 200000
 */
export type Segments1 = LayoutNormalizationSegment[];
export type SourcePdfSha256 = string;
export type SourceSha2562 = string;
export type SourceText2 = string;
/**
 * @minItems 1
 * @maxItems 10000
 */
export type Authorities = [
  LayoutHyphenAuthorityV3,
  ...LayoutHyphenAuthorityV3[],
];
export type Boundary1 = "line" | "column" | "page";
export type Consecutive1 = true;
export type Id1 = string;
export type PreserveLineBreaks1 = false;
export type Role1 =
  | "paragraph"
  | "note"
  | "list_item"
  | "heading"
  | "caption"
  | "credit"
  | "quote";
export type SchemaVersion2 = "ava-layout-hyphen-candidate-2";
export type SourceEnd4 = number;
export type SourceSha2563 = string;
export type SourceStart4 = number;
export type SourceTextSha2561 = string;
export type Classification =
  | LayoutHyphenClassificationReceipt
  | NativeStructureHyphenClassificationReceipt;
export type Authority = "word_wrap";
export type CandidateId2 = string;
export type CatalogueSha256 = string;
export type Decision = "layout" | "literal" | "unresolved";
export type ResponseSha256 = string;
export type SourceCandidateSha256 = string;
export type TaskId = string;
export type TaskSha256 = string;
export type Authority1 = "native_structure";
export type CandidateId3 = string;
export type Decision1 = "layout" | "literal" | "unresolved";
export type ResponseSha2561 = string;
export type SourceCandidateSha2561 = string;
export type TaskId1 = string;
export type TaskSha2561 = string;
export type OriginalSourceOffset = number;
export type Label = string;
export type LineId1 = string;
export type MarkerText = string;
export type OriginalLineSha256 = string;
export type RawPrefix = string;
export type RawPrefixSha256 = string;
export type Role2 = "note" | "list_item";
export type SourceEnd5 = number;
export type SourceStart5 = number;
/**
 * @maxItems 2
 */
export type PairCuts = LayoutSourceCut[];
export type PairSource = string;
export type RetainedLeftLineStart = number;
export type RetainedRightLineStart = number;
export type SourceOffset1 = number;
/**
 * @maxItems 200000
 */
export type InputSegments = NormalizationSegment[];
export type InputTextLength = number;
export type InputTextSha256 = string;
export type OriginalSourceText = string | null;
export type OwnerRole =
  | "paragraph"
  | "note"
  | "list_item"
  | "heading"
  | "caption"
  | "credit"
  | "quote";
export type SchemaVersion3 = "ava-source-normalization-3";
/**
 * @maxItems 200000
 */
export type Segments2 = LayoutNormalizationSegment[];
/**
 * @maxItems 10000
 */
export type SourceCuts = LayoutSourceCut[];
export type SourcePdfSha2561 = string;
export type SourceSha2564 = string;
export type SourceText3 = string;
export type Sha256 = string;
export type End = number;
export type Id2 = string;
export type Link = (InternalTarget | NoteTarget | ExternalTarget) | null;
export type BlockId1 = string;
export type ChapterId1 = string;
export type Kind3 = "note";
export type Offset1 = 0;
export type Kind4 = "external";
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
export type Method1 = "native" | "ocr" | "review" | "replay" | "render";
export type Page1 = number;
export type RegionId1 = string;
export type Id3 = string;
export type Kind5 =
  | "paragraph"
  | "quote"
  | "aside"
  | "caption"
  | "credit"
  | "verse"
  | "code";
export type StyleId1 = string | null;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence2 = [Evidence1, ...Evidence1[]];
export type Id4 = string;
export type Kind6 = "heading";
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
export type Id5 = string;
export type Kind7 = "note";
export type Label1 = string;
export type NoteRole = "footnote" | "endnote";
export type StyleId3 = string | null;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence4 = [Evidence1, ...Evidence1[]];
export type Id6 = string;
export type Kind8 = "list_item";
export type ListId = string;
export type MarkerStyleId = string | null;
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
export type Id7 = string;
export type Kind9 = "figure";
export type ResourceId = string;
export type StyleId5 = string | null;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence6 = [Evidence1, ...Evidence1[]];
export type Id8 = string;
export type Kind10 = "separator";
export type StyleId6 = string | null;
export type CaptionId1 = string | null;
/**
 * @minItems 1
 * @maxItems 160
 */
export type Cells = [TableCell, ...TableCell[]];
export type Column = number;
export type ColumnSpan = number;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence7 = [Evidence1, ...Evidence1[]];
export type HeaderAxis = ("row" | "column" | "both") | null;
/**
 * @maxItems 28
 */
export type HeaderIds = string[];
export type Id9 = string;
export type Row = number;
export type RowSpan = number;
export type StyleId7 = string | null;
export type ColumnCount = number;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence8 = [Evidence1, ...Evidence1[]];
export type Id10 = string;
export type Kind11 = "table";
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
export type Id11 = string;
/**
 * @minItems 1
 * @maxItems 128
 */
export type ResourcePaths = [string, ...string[]];
export type Role3 = "frontmatter" | "bodymatter" | "backmatter";
export type Title = string;
export type CoverResourceId = string | null;
export type DocumentId = string;
export type Depth = number;
export type Id12 = string;
/**
 * @minItems 1
 * @maxItems 20000
 */
export type ItemIds = [string, ...string[]];
export type MarkerStyle =
  | (
      | "decimal"
      | "lower-alpha"
      | "upper-alpha"
      | "lower-roman"
      | "upper-roman"
      | "bullet"
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
  | ("author" | "editor" | "translator" | "illustrator" | "other")
  | null;
/**
 * @maxItems 500
 */
export type Evidence9 = Evidence1[];
export type Field =
  | "title"
  | "subtitle"
  | "contributor"
  | "publisher"
  | "date"
  | "language"
  | "identifier"
  | "rights"
  | "edition"
  | "description"
  | "subject";
export type Id13 = string;
export type IdentifierScheme = ("isbn" | "uuid" | "uri" | "other") | null;
export type Origin = "source" | "user" | "generated";
export type Scope = "work" | "source_edition" | "conversion";
export type Status = "accepted" | "candidate" | "conflict" | "unknown";
export type Value = string | null;
/**
 * @maxItems 1000
 */
export type Metadata = MetadataClaim[];
/**
 * @minItems 1
 * @maxItems 500
 */
export type Pages = [SourcePage1, ...SourcePage1[]];
export type HeightPt = number;
export type Label2 = string | null;
export type Number = number;
export type OriginalRotation = 0 | 90 | 180 | 270;
/**
 * @minItems 1
 * @maxItems 2000
 */
export type Regions = [SourceRegion, ...SourceRegion[]];
export type Band = number;
export type Column1 = 0 | 1 | 2;
export type Id14 = string;
export type Role4 = "content" | "cover" | "furniture" | "blank" | "unsupported";
export type Route =
  | "native"
  | "ocr"
  | "replay"
  | "render"
  | "blank"
  | "unresolved";
export type WidthPt = number;
export type ProfileId = "ava-pdf-prose-en-v2" | "ava-pdf-prose-en-uk-v3";
export type ByteLength = number;
/**
 * @minItems 1
 * @maxItems 500
 */
export type Evidence10 = [Evidence1, ...Evidence1[]];
export type Height = number;
export type Id15 = string;
export type MediaType = "image/png" | "image/jpeg";
export type Path = string;
export type Sha2561 = string;
export type Width = number;
/**
 * @maxItems 1000
 */
export type Resources = ImageResource[];
export type SchemaVersion4 = "ava-book-2";
export type ByteLength1 = number;
export type PageCount = number;
export type Sha2562 = string;
/**
 * @minItems 1
 * @maxItems 20000
 */
export type Spine = [string, ...string[]];
export type Align = ("start" | "left" | "right" | "center" | "justify") | null;
export type BackgroundColor = string | null;
export type BlockIndentEm = number | null;
export type Bold = boolean | null;
export type Color = string | null;
export type DecorationColor = string | null;
export type Family = ("serif" | "sans-serif" | "monospace") | null;
export type Id16 = string;
export type IndentEm = number | null;
export type Italic = boolean | null;
export type LineHeight = number | null;
export type RelativeSize = number | null;
export type SmallCaps = boolean | null;
export type SpaceAfterEm = number | null;
export type SpaceBeforeEm = number | null;
export type StrikeThrough = boolean | null;
export type Underline = boolean | null;
export type VerticalAlign = ("baseline" | "super" | "sub") | null;
/**
 * @maxItems 5000
 */
export type Styles = Style[];
/**
 * @minItems 1
 * @maxItems 20000
 */
export type Toc = [TocEntry, ...TocEntry[]];
export type Id17 = string;
export type Label3 = string;
export type ParentId = string | null;
export type CanonicalHashAlgorithm = "ava-json-v1";
export type CanonicalSha256 = string;
export type FinalContentId = string;
/**
 * @minItems 1
 * @maxItems 12
 */
export type RequiredCapabilities = [
  (
    | "text"
    | "styles"
    | "links"
    | "notes"
    | "figures"
    | "tables"
    | "lists"
    | "literal-text"
    | "annotation-styles"
    | "language"
    | "source-page-starts"
    | "list-marker-styles"
  ),
  ...(
    | "text"
    | "styles"
    | "links"
    | "notes"
    | "figures"
    | "tables"
    | "lists"
    | "literal-text"
    | "annotation-styles"
    | "language"
    | "source-page-starts"
    | "list-marker-styles"
  )[],
];
export type SchemaVersion5 = "ava-reader-3";
export type Version = 3;

export interface ReaderPackageV3 {
  book: CanonicalBookV2;
  canonical_hash_algorithm: CanonicalHashAlgorithm;
  canonical_sha256: CanonicalSha256;
  final_content_id: FinalContentId;
  required_capabilities: RequiredCapabilities;
  schema_version: SchemaVersion5;
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
  schema_version: SchemaVersion4;
  source: SourcePdf;
  spine: Spine;
  styles: Styles;
  toc: Toc;
}
export interface Address {
  fragment: Fragment;
  resource_path: ResourcePath;
  source_page?: SourcePage;
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
  id: Id3;
  kind: Kind5;
  style_id?: StyleId1;
}
export interface TextValue {
  codepoint_utf16: CodepointUtf16;
  language?: Language;
  normalization?: Normalization;
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
export interface LayoutNormalizationMap {
  candidates: Candidates;
  derivations: Derivations;
  dispositions: Dispositions;
  schema_version: SchemaVersion1;
  segments: Segments1;
  source_pdf_sha256: SourcePdfSha256;
  source_sha256: SourceSha2562;
  source_text: SourceText2;
}
export interface LayoutHyphenCandidate {
  boundary: Boundary;
  consecutive: Consecutive;
  id: Id;
  left: LayoutHyphenLine;
  preserve_line_breaks: PreserveLineBreaks;
  right: LayoutHyphenLine;
  role: Role;
  schema_version: SchemaVersion;
  source_end: SourceEnd2;
  source_sha256: SourceSha2561;
  source_start: SourceStart2;
  source_text_sha256: SourceTextSha256;
}
export interface LayoutHyphenLine {
  box: Box;
  line_id: LineId;
  method: Method;
  page: Page;
  region_id: RegionId;
  source_end: SourceEnd1;
  source_start: SourceStart1;
}
export interface Box {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
export interface LayoutHyphenDerivation {
  source_candidate: LayoutHyphenCandidate;
  source_disposition: LayoutHyphenDisposition;
  source_offset: SourceOffset;
  source_text: SourceText1;
}
export interface LayoutHyphenDisposition {
  candidate_id: CandidateId;
  candidate_sha256: CandidateSha256;
  disposition: Disposition;
}
export interface LayoutNormalizationSegment {
  candidate_id?: CandidateId1;
  canonical_end: CanonicalEnd1;
  canonical_start: CanonicalStart1;
  kind: Kind2;
  source_end: SourceEnd3;
  source_start: SourceStart3;
}
export interface LayoutNormalizationMapV3 {
  authorities: Authorities;
  input_segments: InputSegments;
  input_text_length: InputTextLength;
  input_text_sha256: InputTextSha256;
  original_source_text?: OriginalSourceText;
  owner_role: OwnerRole;
  schema_version: SchemaVersion3;
  segments: Segments2;
  source_cuts: SourceCuts;
  source_pdf_sha256: SourcePdfSha2561;
  source_sha256: SourceSha2564;
  source_text: SourceText3;
}
export interface LayoutHyphenAuthorityV3 {
  candidate: LayoutHyphenCandidateV2;
  classification: Classification;
  original_source_offset: OriginalSourceOffset;
  pair_cuts: PairCuts;
  pair_source: PairSource;
  retained_left_line_start: RetainedLeftLineStart;
  retained_right_line_start: RetainedRightLineStart;
  source_offset: SourceOffset1;
}
export interface LayoutHyphenCandidateV2 {
  boundary: Boundary1;
  consecutive: Consecutive1;
  id: Id1;
  left: LayoutHyphenLine;
  preserve_line_breaks: PreserveLineBreaks1;
  right: LayoutHyphenLine;
  role: Role1;
  schema_version: SchemaVersion2;
  source_end: SourceEnd4;
  source_sha256: SourceSha2563;
  source_start: SourceStart4;
  source_text_sha256: SourceTextSha2561;
}
export interface LayoutHyphenClassificationReceipt {
  authority: Authority;
  candidate_id: CandidateId2;
  catalogue_sha256: CatalogueSha256;
  decision: Decision;
  response_sha256: ResponseSha256;
  source_candidate_sha256: SourceCandidateSha256;
  task_id: TaskId;
  task_sha256: TaskSha256;
}
export interface NativeStructureHyphenClassificationReceipt {
  authority: Authority1;
  candidate_id: CandidateId3;
  decision: Decision1;
  original_candidate: LayoutHyphenCandidate;
  response_sha256: ResponseSha2561;
  source_candidate_sha256: SourceCandidateSha2561;
  task_id: TaskId1;
  task_sha256: TaskSha2561;
}
export interface LayoutSourceCut {
  receipt: PrefixCutReceipt;
  source_end: SourceEnd5;
  source_start: SourceStart5;
}
export interface PrefixCutReceipt {
  label: Label;
  line_id: LineId1;
  marker_text: MarkerText;
  original_line_sha256: OriginalLineSha256;
  raw_prefix: RawPrefix;
  raw_prefix_sha256: RawPrefixSha256;
  role: Role2;
}
export interface InlineSpan {
  end: End;
  id: Id2;
  link?: Link;
  start: Start;
  style_id?: StyleId;
}
export interface NoteTarget {
  block_id: BlockId1;
  chapter_id: ChapterId1;
  kind: Kind3;
  offset: Offset1;
}
export interface ExternalTarget {
  kind: Kind4;
  url: Url;
}
export interface Evidence1 {
  box: Box;
  method: Method1;
  page: Page1;
  region_id: RegionId1;
}
export interface HeadingBlock {
  content: TextValue;
  evidence: Evidence2;
  id: Id4;
  kind: Kind6;
  level: Level;
  style_id?: StyleId2;
}
export interface NoteBlock {
  callout_ids: CalloutIds;
  content: TextValue;
  evidence: Evidence3;
  id: Id5;
  kind: Kind7;
  label: Label1;
  note_role: NoteRole;
  style_id?: StyleId3;
}
export interface ListItemBlock {
  content: TextValue;
  evidence: Evidence4;
  id: Id6;
  kind: Kind8;
  list_id: ListId;
  marker_style_id?: MarkerStyleId;
  style_id?: StyleId4;
}
export interface FigureBlock {
  alt: Alt;
  caption_id?: CaptionId;
  credit_id?: CreditId;
  decorative: Decorative;
  evidence: Evidence5;
  id: Id7;
  kind: Kind9;
  resource_id: ResourceId;
  style_id?: StyleId5;
}
export interface SeparatorBlock {
  evidence: Evidence6;
  id: Id8;
  kind: Kind10;
  style_id?: StyleId6;
}
export interface TableBlock {
  caption_id?: CaptionId1;
  cells: Cells;
  column_count: ColumnCount;
  evidence: Evidence8;
  id: Id10;
  kind: Kind11;
  row_count: RowCount;
  style_id?: StyleId8;
}
export interface TableCell {
  column: Column;
  column_span?: ColumnSpan;
  content: TextValue;
  evidence: Evidence7;
  header_axis?: HeaderAxis;
  header_ids?: HeaderIds;
  id: Id9;
  row: Row;
  row_span?: RowSpan;
  style_id?: StyleId7;
}
export interface Chapter {
  block_ids: BlockIds;
  id: Id11;
  resource_paths: ResourcePaths;
  role: Role3;
  title: Title;
}
export interface ListGroup {
  depth: Depth;
  id: Id12;
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
  id: Id13;
  identifier_scheme?: IdentifierScheme;
  origin: Origin;
  scope: Scope;
  status: Status;
  value?: Value;
}
export interface SourcePage1 {
  height_pt: HeightPt;
  label?: Label2;
  number: Number;
  original_rotation: OriginalRotation;
  regions: Regions;
  width_pt: WidthPt;
}
export interface SourceRegion {
  band: Band;
  box: Box;
  column: Column1;
  id: Id14;
  role: Role4;
  route: Route;
}
export interface ImageResource {
  byte_length: ByteLength;
  evidence: Evidence10;
  height: Height;
  id: Id15;
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
  background_color?: BackgroundColor;
  block_indent_em?: BlockIndentEm;
  bold?: Bold;
  color?: Color;
  decoration_color?: DecorationColor;
  family?: Family;
  id: Id16;
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
export interface TocEntry {
  id: Id17;
  label: Label3;
  parent_id?: ParentId;
  target: InternalTarget;
}
