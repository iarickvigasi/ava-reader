/* Generated from Python recognition models; do not edit. */

export type CatalogueSha256 = string;
export type Classification = 'eligible' | 'preserved' | 'unsupported';
export type EntryId = string | null;
export type LineId = string;
export type NextLineId = string | null;
export type OwnerId = string | null;
export type Page = number;
export type Reason =
  | 'qualified'
  | 'preserved_line_breaks'
  | 'unsupported_role'
  | 'no_final_native_owner'
  | 'no_following_owner_line'
  | 'not_letter_pair'
  | 'outside_retained_body'
  | 'unsupported_boundary'
  | 'split_word_exceeds_context';
export type Resolution = ('request' | 'reuse') | null;
export type TextSha256 = string;
/**
 * @maxItems 100000
 */
export type Census = WordWrapCensusEntry[];
export type CensusSha256 = string;
export type Boundary = 'line' | 'column' | 'page';
export type Consecutive = true;
export type Id = string;
export type CoordinateSpace = 'page_points_top_left' | 'normalized_top_left';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type LineId1 = string;
export type Method = 'native' | 'ocr';
export type Page1 = number;
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
export type LineId2 = string;
export type Page2 = number;
export type RegionId1 = string;
export type SourceEnd2 = number;
export type SourceStart2 = number;
export type Text = string;
export type TextSha2561 = string;
export type OriginalOwnerSourceOffset = number;
export type OwnerId1 = string;
export type OwnerOriginalSha256 = string;
export type OwnerSourceOffset = number;
export type OwnerSourceSha256 = string;
export type Label = string;
export type LineId3 = string;
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
/**
 * @maxItems 4096
 */
export type Entries = WordWrapEntry[];
export type ObservationSha256 = string;
export type Policy = 'ava-native-word-wrap-1';
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type SchemaVersion2 = 'ava-native-word-wrap-batch-1';
export type SourceSha2562 = string;
export type BatchCount = number;
export type BatchIndex = number;
export type CatalogueSha2561 = string;
/**
 * @minItems 1
 * @maxItems 128
 */
export type Entries1 = [WordWrapEntry, ...WordWrapEntry[]];
export type ObservationSha2561 = string;
export type Policy1 = 'ava-native-word-wrap-1';
export type ProfileId1 = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type Purpose = 'pdf_native_word_wrap';
export type SchemaVersion3 = 'ava-native-word-wrap-task-1';
export type SourceSha2563 = string;
export type TaskId1 = string;
/**
 * @maxItems 32
 */
export type Tasks = WordWrapTask[];

export interface WordWrapBatch {
  catalogue_sha256: CatalogueSha256;
  census: Census;
  census_sha256: CensusSha256;
  entries: Entries;
  observation_sha256: ObservationSha256;
  policy: Policy;
  profile_id: ProfileId;
  schema_version: SchemaVersion2;
  source_sha256: SourceSha2562;
  tasks: Tasks;
}
export interface WordWrapCensusEntry {
  classification: Classification;
  entry_id?: EntryId;
  line_id: LineId;
  next_line_id?: NextLineId;
  owner_id?: OwnerId;
  page: Page;
  reason: Reason;
  resolution?: Resolution;
  text_sha256: TextSha256;
}
export interface WordWrapEntry {
  candidate: LayoutHyphenCandidateV2;
  context: Context;
  id: Id1;
  language: Language;
  left: WordWrapSourceLine;
  original_owner_source_offset: OriginalOwnerSourceOffset;
  owner_id: OwnerId1;
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
  line_id: LineId1;
  method: Method;
  page: Page1;
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
  line_id: LineId2;
  page: Page2;
  region_id: RegionId1;
  source_end: SourceEnd2;
  source_start: SourceStart2;
  text: Text;
  text_sha256: TextSha2561;
}
export interface LayoutSourceCut {
  receipt: PrefixCutReceipt;
  source_end: SourceEnd3;
  source_start: SourceStart3;
}
export interface PrefixCutReceipt {
  label: Label;
  line_id: LineId3;
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
export interface WordWrapTask {
  batch_count: BatchCount;
  batch_index: BatchIndex;
  catalogue_sha256: CatalogueSha2561;
  entries: Entries1;
  observation_sha256: ObservationSha2561;
  policy: Policy1;
  profile_id: ProfileId1;
  purpose: Purpose;
  schema_version: SchemaVersion3;
  source_sha256: SourceSha2563;
  task_id: TaskId1;
}
