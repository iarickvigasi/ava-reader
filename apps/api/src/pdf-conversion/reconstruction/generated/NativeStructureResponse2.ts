/* Generated from Python recognition models; do not edit. */

export type CandidateId = string;
export type CandidateSha256 = string;
export type Disposition = 'layout' | 'literal' | 'unresolved';
/**
 * @maxItems 10000
 */
export type BoundaryDispositions = LayoutHyphenDisposition[];
export type ChapterRole = 'frontmatter' | 'bodymatter' | 'backmatter';
export type HeadingRole = 'chapter';
export type Id = string;
export type Kind = 'heading';
/**
 * @minItems 1
 * @maxItems 10000
 */
export type LineIds = [string, ...string[]];
export type RegionId = string;
export type HeadingLevel = number;
export type HeadingRole1 = 'section';
export type Id1 = string;
export type Kind1 = 'heading';
/**
 * @minItems 1
 * @maxItems 10000
 */
export type LineIds1 = [string, ...string[]];
export type RegionId1 = string;
export type ContinuesFromPrevious = boolean;
export type ContinuesToNext = boolean;
export type Id2 = string;
export type Kind2 = 'paragraph';
/**
 * @minItems 1
 * @maxItems 10000
 */
export type LineIds2 = [string, ...string[]];
export type RegionId2 = string;
export type Id3 = string;
export type Kind3 = 'note';
/**
 * @minItems 1
 * @maxItems 10000
 */
export type LineIds3 = [string, ...string[]];
export type NoteLabel = string;
export type NoteRole = 'footnote' | 'endnote';
export type RegionId3 = string;
export type Id4 = string;
export type Kind4 = 'list_item';
/**
 * @minItems 1
 * @maxItems 10000
 */
export type LineIds4 = [string, ...string[]];
export type ListDepth = number;
export type ListRole = 'ordered';
export type ListStart = number;
export type RegionId4 = string;
export type Id5 = string;
export type Kind5 = 'list_item';
/**
 * @minItems 1
 * @maxItems 10000
 */
export type LineIds5 = [string, ...string[]];
export type ListDepth1 = number;
export type ListRole1 = 'unordered';
export type RegionId5 = string;
export type Id6 = string;
export type Kind6 = 'caption' | 'credit';
/**
 * @minItems 1
 * @maxItems 10000
 */
export type LineIds6 = [string, ...string[]];
export type RegionId6 = string;
export type RelatedTo = string | null;
export type Id7 = string;
export type Kind7 =
  | 'quote'
  | 'aside'
  | 'verse'
  | 'code'
  | 'separator'
  | 'furniture';
/**
 * @minItems 1
 * @maxItems 10000
 */
export type LineIds7 = [string, ...string[]];
export type RegionId7 = string;
/**
 * @maxItems 2000
 */
export type Groups = (
  | NativeChapterGroup2
  | NativeSectionGroup2
  | NativeParagraphGroup2
  | NativeNoteGroup2
  | NativeOrderedListGroup2
  | NativeUnorderedListGroup2
  | NativeRelatedGroup2
  | NativePlainGroup2
)[];
export type Language = string;
export type ObservationSha256 = string;
export type Role = 'note_callout';
export type SpanId = string;
/**
 * @maxItems 20000
 */
export type References = NativeStructureReference[];
export type RenderSha256 = string;
export type SchemaVersion = 'ava-native-structure-response-2';
export type SourceSha256 = string;
export type TaskId = string;
/**
 * @maxItems 100
 */
export type Unresolved = string[];

export interface NativeStructureResponse2 {
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
export interface NativeChapterGroup2 {
  chapter_role: ChapterRole;
  heading_role: HeadingRole;
  id: Id;
  kind: Kind;
  line_ids: LineIds;
  region_id: RegionId;
}
export interface NativeSectionGroup2 {
  heading_level: HeadingLevel;
  heading_role: HeadingRole1;
  id: Id1;
  kind: Kind1;
  line_ids: LineIds1;
  region_id: RegionId1;
}
export interface NativeParagraphGroup2 {
  continues_from_previous: ContinuesFromPrevious;
  continues_to_next: ContinuesToNext;
  id: Id2;
  kind: Kind2;
  line_ids: LineIds2;
  region_id: RegionId2;
}
export interface NativeNoteGroup2 {
  id: Id3;
  kind: Kind3;
  line_ids: LineIds3;
  note_label: NoteLabel;
  note_role: NoteRole;
  region_id: RegionId3;
}
export interface NativeOrderedListGroup2 {
  id: Id4;
  kind: Kind4;
  line_ids: LineIds4;
  list_depth: ListDepth;
  list_role: ListRole;
  list_start: ListStart;
  region_id: RegionId4;
}
export interface NativeUnorderedListGroup2 {
  id: Id5;
  kind: Kind5;
  line_ids: LineIds5;
  list_depth: ListDepth1;
  list_role: ListRole1;
  region_id: RegionId5;
}
export interface NativeRelatedGroup2 {
  id: Id6;
  kind: Kind6;
  line_ids: LineIds6;
  region_id: RegionId6;
  related_to: RelatedTo;
}
export interface NativePlainGroup2 {
  id: Id7;
  kind: Kind7;
  line_ids: LineIds7;
  region_id: RegionId7;
}
export interface NativeStructureReference {
  role: Role;
  span_id: SpanId;
}
