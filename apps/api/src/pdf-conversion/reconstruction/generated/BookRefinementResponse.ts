/* Generated from Python recognition models; do not edit. */

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
