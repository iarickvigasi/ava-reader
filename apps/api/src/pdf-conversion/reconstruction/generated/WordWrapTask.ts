/* Generated from Python recognition models; do not edit. */

export type BatchCount = number;
export type BatchIndex = number;
export type CatalogueSha256 = string;
/**
 * @minItems 1
 * @maxItems 128
 */
export type Entries = [WordWrapEntry, ...WordWrapEntry[]];
export type Boundary = 'line' | 'column' | 'page';
export type Consecutive = true;
export type Id = string;
export type CoordinateSpace = 'page_points_top_left' | 'normalized_top_left';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type LineId = string;
export type Method = 'native' | 'ocr';
export type Page = number;
export type RegionId = string;
export type SourceEnd = number;
export type SourceStart = number;
export type PreserveLineBreaks = false;
export type Role =
  | 'paragraph'
  | 'note'
  | 'list_item'
  | 'heading'
  | 'caption'
  | 'credit'
  | 'quote';
export type SchemaVersion = 'ava-layout-hyphen-candidate-2';
export type SourceEnd1 = number;
export type SourceSha256 = string;
export type SourceStart1 = number;
export type SourceTextSha256 = string;
export type Context = string;
export type Id1 = string;
export type Language = string;
export type LineId1 = string;
export type Page1 = number;
export type RegionId1 = string;
export type SourceEnd2 = number;
export type SourceStart2 = number;
export type Text = string;
export type TextSha256 = string;
export type OriginalOwnerSourceOffset = number;
export type OwnerId = string;
export type OwnerOriginalSha256 = string;
export type OwnerSourceOffset = number;
export type OwnerSourceSha256 = string;
export type Label = string;
export type LineId2 = string;
export type MarkerText = string;
export type OriginalLineSha256 = string;
export type RawPrefix = string;
export type RawPrefixSha256 = string;
export type Role1 = 'note' | 'list_item';
export type SourceEnd3 = number;
export type SourceStart3 = number;
/**
 * @maxItems 2
 */
export type PairCuts = LayoutSourceCut[];
export type Authority = 'native_structure';
export type CandidateId = string;
export type Decision = 'layout' | 'literal' | 'unresolved';
export type Boundary1 = 'line' | 'column' | 'page';
export type Consecutive1 = true;
export type Id2 = string;
export type PreserveLineBreaks1 = false;
export type Role2 = 'paragraph' | 'note' | 'list_item';
export type SchemaVersion1 = 'ava-layout-hyphen-candidate-1';
export type SourceEnd4 = number;
export type SourceSha2561 = string;
export type SourceStart4 = number;
export type SourceTextSha2561 = string;
export type ResponseSha256 = string;
export type SourceCandidateSha256 = string;
export type TaskId = string;
export type TaskSha256 = string;
export type Role3 =
  | 'paragraph'
  | 'note'
  | 'list_item'
  | 'heading'
  | 'caption'
  | 'credit'
  | 'quote';
export type SourcePair = string;
export type ObservationSha256 = string;
export type Policy = 'ava-native-word-wrap-1';
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type Purpose = 'pdf_native_word_wrap';
export type SchemaVersion2 = 'ava-native-word-wrap-task-1';
export type SourceSha2562 = string;
export type TaskId1 = string;

export interface WordWrapTask {
  batch_count: BatchCount;
  batch_index: BatchIndex;
  catalogue_sha256: CatalogueSha256;
  entries: Entries;
  observation_sha256: ObservationSha256;
  policy: Policy;
  profile_id: ProfileId;
  purpose: Purpose;
  schema_version: SchemaVersion2;
  source_sha256: SourceSha2562;
  task_id: TaskId1;
}
export interface WordWrapEntry {
  candidate: LayoutHyphenCandidateV2;
  context: Context;
  id: Id1;
  language: Language;
  left: WordWrapSourceLine;
  original_owner_source_offset: OriginalOwnerSourceOffset;
  owner_id: OwnerId;
  owner_original_sha256: OwnerOriginalSha256;
  owner_source_offset: OwnerSourceOffset;
  owner_source_sha256: OwnerSourceSha256;
  pair_cuts?: PairCuts;
  reused_authority?: NativeStructureHyphenClassificationReceipt | null;
  right: WordWrapSourceLine;
  role: Role3;
  source_pair: SourcePair;
}
export interface LayoutHyphenCandidateV2 {
  boundary: Boundary;
  consecutive: Consecutive;
  id: Id;
  left: LayoutHyphenLine;
  preserve_line_breaks: PreserveLineBreaks;
  right: LayoutHyphenLine;
  role: Role;
  schema_version: SchemaVersion;
  source_end: SourceEnd1;
  source_sha256: SourceSha256;
  source_start: SourceStart1;
  source_text_sha256: SourceTextSha256;
}
export interface LayoutHyphenLine {
  box: Box;
  line_id: LineId;
  method: Method;
  page: Page;
  region_id: RegionId;
  source_end: SourceEnd;
  source_start: SourceStart;
}
export interface Box {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
export interface WordWrapSourceLine {
  box: Box;
  line_id: LineId1;
  page: Page1;
  region_id: RegionId1;
  source_end: SourceEnd2;
  source_start: SourceStart2;
  text: Text;
  text_sha256: TextSha256;
}
export interface LayoutSourceCut {
  receipt: PrefixCutReceipt;
  source_end: SourceEnd3;
  source_start: SourceStart3;
}
export interface PrefixCutReceipt {
  label: Label;
  line_id: LineId2;
  marker_text: MarkerText;
  original_line_sha256: OriginalLineSha256;
  raw_prefix: RawPrefix;
  raw_prefix_sha256: RawPrefixSha256;
  role: Role1;
}
export interface NativeStructureHyphenClassificationReceipt {
  authority: Authority;
  candidate_id: CandidateId;
  decision: Decision;
  original_candidate: LayoutHyphenCandidate;
  response_sha256: ResponseSha256;
  source_candidate_sha256: SourceCandidateSha256;
  task_id: TaskId;
  task_sha256: TaskSha256;
}
export interface LayoutHyphenCandidate {
  boundary: Boundary1;
  consecutive: Consecutive1;
  id: Id2;
  left: LayoutHyphenLine;
  preserve_line_breaks: PreserveLineBreaks1;
  right: LayoutHyphenLine;
  role: Role2;
  schema_version: SchemaVersion1;
  source_end: SourceEnd4;
  source_sha256: SourceSha2561;
  source_start: SourceStart4;
  source_text_sha256: SourceTextSha2561;
}
