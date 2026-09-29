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
export type Bold = boolean;
export type Family = ('serif' | 'sans-serif' | 'monospace') | null;
export type Id = 'observed';
export type IndentEm = number | null;
export type Italic = boolean | null;
export type LineHeight = number | null;
export type RelativeSize = number;
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
  style: RefinementStyle;
  text_sha256: TextSha256;
}
/**
 * Sparse source typography with the wire observations required by acceptance.
 */
export interface RefinementStyle {
  align?: Align;
  bold: Bold;
  family?: Family;
  id: Id;
  indent_em?: IndentEm;
  italic?: Italic;
  line_height?: LineHeight;
  relative_size: RelativeSize;
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
