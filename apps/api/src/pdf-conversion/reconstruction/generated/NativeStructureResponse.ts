/* Generated from Python recognition models; do not edit. */

export type CandidateId = string;
export type CandidateSha256 = string;
export type Disposition = 'layout' | 'literal' | 'unresolved';
/**
 * @maxItems 10000
 */
export type BoundaryDispositions = LayoutHyphenDisposition[];
export type ChapterRole = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart = boolean;
export type ContinuesFromPrevious = boolean;
export type ContinuesToNext = boolean;
export type HeadingLevel = number | null;
export type Id = string;
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
  | 'separator'
  | 'furniture';
/**
 * @minItems 1
 * @maxItems 10000
 */
export type LineIds = [string, ...string[]];
export type ListDepth = number | null;
export type ListOrdered = boolean | null;
export type ListStart = number | null;
export type NoteLabel = string | null;
export type NoteRole = ('footnote' | 'endnote') | null;
export type RegionId = string;
export type RelatedTo = string | null;
/**
 * @maxItems 2000
 */
export type Groups = NativeStructureGroup[];
export type Language = string;
export type ObservationSha256 = string;
export type Role = 'note_callout';
export type SpanId = string;
/**
 * @maxItems 20000
 */
export type References = NativeStructureReference[];
export type RenderSha256 = string;
export type SchemaVersion = 'ava-native-structure-response-1';
export type SourceSha256 = string;
export type TaskId = string;
/**
 * @maxItems 100
 */
export type Unresolved = string[];

export interface NativeStructureResponse {
  boundary_dispositions: BoundaryDispositions;
  groups: Groups;
  language: Language;
  observation_sha256: ObservationSha256;
  references: References;
  render_sha256: RenderSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
  unresolved: Unresolved;
}
export interface LayoutHyphenDisposition {
  candidate_id: CandidateId;
  candidate_sha256: CandidateSha256;
  disposition: Disposition;
}
export interface NativeStructureGroup {
  chapter_role?: ChapterRole;
  chapter_start?: ChapterStart;
  continues_from_previous?: ContinuesFromPrevious;
  continues_to_next?: ContinuesToNext;
  heading_level?: HeadingLevel;
  id: Id;
  kind: Kind;
  line_ids: LineIds;
  list_depth?: ListDepth;
  list_ordered?: ListOrdered;
  list_start?: ListStart;
  note_label?: NoteLabel;
  note_role?: NoteRole;
  region_id: RegionId;
  related_to?: RelatedTo;
}
export interface NativeStructureReference {
  role: Role;
  span_id: SpanId;
}
