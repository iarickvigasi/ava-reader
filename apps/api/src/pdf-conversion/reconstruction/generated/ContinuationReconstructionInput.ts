/* Generated from Python recognition models; do not edit. */

export type OriginalResponseJson = string;
export type OriginalResponseSha256 = string;
export type OriginalResponseSha2561 = string;
export type OriginalTaskId = string;
export type Outcome = 'corrected' | 'unresolved';
export type CoordinateSpace = 'render_normalized_1000';
export type X0 = number;
export type X1 = number;
export type Y0 = number;
export type Y1 = number;
export type SegmentId = string;
/**
 * @maxItems 32
 */
export type Patches = RecognitionGeometryPatch[];
export type RenderSha256 = string;
export type SchemaVersion = 'ava-recognition-geometry-response-1';
export type SourceSha256 = string;
export type TaskId = string;
export type UnresolvedReason =
  | ('IMAGE_UNCLEAR' | 'NO_UNIQUE_SOURCE_BOX')
  | null;
export type OriginalResponseJson1 = string;
export type OriginalResponseSha2562 = string;
export type OriginalResponseSha2563 = string;
export type OriginalTaskId1 = string;
export type Outcome1 = 'corrected' | 'unresolved';
export type SlotId = string;
/**
 * @maxItems 32
 */
export type Patches1 = RecognitionCellGeometryPatch[];
export type RenderSha2561 = string;
export type SchemaVersion1 = 'ava-recognition-cell-geometry-response-1';
export type SourceSha2561 = string;
export type TaskId1 = string;
export type UnresolvedReason1 =
  | ('IMAGE_UNCLEAR' | 'NO_UNIQUE_SOURCE_BOX')
  | null;
/**
 * @maxItems 25000
 */
export type GeometryCorrections = (
  | RecognitionGeometryProof
  | RecognitionCellGeometryProof
)[];
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
export type RenderSha2562 = string;
export type SchemaVersion2 = 'ava-native-structure-response-2';
export type SourceSha2562 = string;
export type TaskId2 = string;
/**
 * @maxItems 100
 */
export type Unresolved = string[];
/**
 * @maxItems 25000
 */
export type NativeStructureResponses = NativeStructureResponse2[];
export type ProfileId = 'ava-pdf-prose-en-v2' | 'ava-pdf-prose-en-uk-v3';
export type RecognitionRepairPolicy = 'ava-recognition-geometry-repair-2';
export type ChapterRole1 = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart = boolean | null;
/**
 * @minItems 1
 * @maxItems 48
 */
export type EvidenceIds = [string, ...string[]];
export type HeadingLevel1 = number | null;
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
export type ChapterRole2 = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart1 = boolean | null;
/**
 * @minItems 1
 * @maxItems 48
 */
export type EvidenceIds1 = [string, ...string[]];
export type HeadingLevel2 = number | null;
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
export type Id8 = 'observed';
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
export type Role1 =
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
export type ObservationSha2561 = string;
export type SchemaVersion3 = 'ava-book-refinement-response-3';
export type SourceSha2563 = string;
export type TaskId3 = string;
/**
 * @maxItems 100
 */
export type Unresolved1 = string[];
/**
 * @maxItems 0
 */
export type Decisions1 = [];
/**
 * @minItems 1
 * @maxItems 24
 */
export type FeatureDecisions = [
  SourceFeatureDecision,
  ...SourceFeatureDecision[],
];
/**
 * @minItems 1
 * @maxItems 7
 */
export type Features = [
  SourceFeatureObservation,
  ...SourceFeatureObservation[],
];
export type Disposition1 = 'observed' | 'unknown' | 'not_applicable';
/**
 * @minItems 1
 * @maxItems 4
 */
export type EvidenceIds4 = [string, ...string[]];
export type Feature =
  | 'paragraph_role'
  | 'family'
  | 'weight'
  | 'italic'
  | 'first_line_indent'
  | 'block_inset'
  | 'relative_size';
export type Reason =
  | (
      | 'source_blurred'
      | 'source_clipped'
      | 'source_context_insufficient'
      | 'heading_has_no_prose_first_line'
    )
  | null;
export type Value =
  | ('paragraph' | 'quote' | 'serif' | 'sans-serif' | 'monospace')
  | boolean
  | number
  | null;
export type NodeId3 = string;
export type TextSha2563 = string;
export type ImageSha2561 = string;
/**
 * @maxItems 0
 */
export type Joins1 = [];
/**
 * @maxItems 0
 */
export type MetadataDecisions1 = [];
export type ObservationSha2562 = string;
export type SchemaVersion4 = 'ava-book-refinement-response-4';
export type SourceSha2564 = string;
export type TaskId4 = string;
/**
 * @maxItems 100
 */
export type Unresolved2 = string[];
/**
 * @minItems 2
 * @maxItems 9
 */
export type EvidenceIds5 = [string, string, ...string[]];
/**
 * @minItems 1
 * @maxItems 8
 */
export type NodeIds = [string, ...string[]];
/**
 * @maxItems 2
 */
export type EvidenceIds6 = string[];
export type ImageSha2562 = string;
export type ObservationSha2563 = string;
export type SchemaVersion5 = 'ava-printed-title-response-2';
export type SelectedNodeId = string | null;
export type SelectedTextSha256 = string | null;
export type SourceSha2565 = string;
export type TaskId5 = string;
export type ChapterRole3 = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart2 = boolean | null;
/**
 * @minItems 1
 * @maxItems 48
 */
export type EvidenceIds7 = [string, ...string[]];
export type HeadingLevel3 = number | null;
export type NodeId4 = string;
export type ParentId2 = string | null;
export type RoleKind2 =
  | ('heading' | 'paragraph' | 'list_item' | 'verse' | 'quote')
  | null;
export type TextSha2564 = string;
/**
 * @maxItems 24
 */
export type Decisions2 = RefinementDecision[];
export type ImageSha2563 = string;
/**
 * @maxItems 16
 */
export type Joins2 = RefinementJoin[];
/**
 * @maxItems 24
 */
export type MetadataDecisions2 = BibliographicDecision[];
export type ObservationSha2564 = string;
export type CandidateId1 = string | null;
export type EdgeId1 = string;
/**
 * @maxItems 4
 */
export type EvidenceIds8 = string[];
/**
 * @maxItems 16
 */
export type Presentations = JoinPresentationChoice[];
export type SchemaVersion6 = 'ava-book-refinement-response-5';
export type SourceSha2566 = string;
export type TaskId6 = string;
/**
 * @maxItems 100
 */
export type Unresolved3 = string[];
export type ImageSha2564 = string;
export type ObservationSha2565 = string;
/**
 * @minItems 1
 * @maxItems 24
 */
export type RoleDecisions = [SourceRoleDecision, ...SourceRoleDecision[]];
/**
 * @minItems 2
 * @maxItems 2
 */
export type EvidenceIds9 = [string, string];
export type NodeId5 = string;
export type Reason1 =
  | ('source_blurred' | 'source_clipped' | 'source_context_insufficient')
  | null;
export type Role2 = ('paragraph' | 'quote') | null;
export type TextSha2565 = string;
export type SchemaVersion7 = 'ava-book-refinement-response-6';
export type SourceSha2567 = string;
export type TaskId7 = string;
/**
 * @maxItems 100
 */
export type Unresolved4 = string[];
/**
 * @maxItems 64
 */
export type Refinements = (
  | BookRefinementResponse
  | SourceFeatureResponse
  | FrontmatterTitleResponse
  | PresentationRefinementResponse
  | SourceRoleResponse
)[];
export type Language1 = string;
export type RenderSha2563 = string;
export type SchemaVersion8 = 'ava-recognition-response-2';
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
export type ColumnSpan = number;
export type HeaderAxis = ('row' | 'column' | 'both') | null;
export type RowSpan = number;
export type SourceCellId = string | null;
/**
 * Exact immediately adjacent following context in the same finalized text, including Unicode and spaces. Empty means no following-context constraint.
 */
export type After = string;
/**
 * Exact immediately adjacent preceding context in the same finalized text, including Unicode and spaces. Empty means no preceding-context constraint.
 */
export type Before = string;
/**
 * Copy verbatim from the finalized owning segment/cell text. Unicode scalars, case and spaces must be identical; an ordinary digit cannot anchor a Unicode script digit. Together with before/after, this quotation must identify exactly one occurrence.
 */
export type ExactText = string;
export type End1 = number | null;
export type NoteLabel1 = string | null;
export type Start1 = number | null;
export type Align1 = ('start' | 'left' | 'right' | 'center' | 'justify') | null;
export type BackgroundColor1 = string | null;
export type BlockIndentEm1 = number | null;
export type Bold1 = boolean | null;
export type Color1 = string | null;
export type DecorationColor1 = string | null;
export type Family1 = ('serif' | 'sans-serif' | 'monospace') | null;
export type Id9 = string;
export type IndentEm1 = number | null;
export type Italic1 = boolean | null;
export type LineHeight1 = number | null;
export type RelativeSize1 = number | null;
export type SmallCaps1 = boolean | null;
export type SpaceAfterEm1 = number | null;
export type SpaceBeforeEm1 = number | null;
export type StrikeThrough1 = boolean | null;
export type Underline1 = boolean | null;
export type VerticalAlign1 = ('baseline' | 'super' | 'sub') | null;
export type TargetText = string | null;
export type Url = string | null;
/**
 * @maxItems 20000
 */
export type Spans = RecognitionSpan[];
/**
 * Finalize this cell's exact source transcription before quoting any span. Characters and placement are separate: ordinary raised/lowered digits use ordinary text plus vertical_align; intrinsic Unicode stays exact. Every anchor/context quotes this text.
 */
export type Text = string;
/**
 * @maxItems 20
 */
export type Cells = RecognitionCell[][];
export type ChapterRole4 = ('frontmatter' | 'bodymatter' | 'backmatter') | null;
export type ChapterStart3 = boolean;
export type ContinuesFromPrevious1 = boolean;
export type ContinuesToNext1 = boolean;
export type HeadingLevel4 = number | null;
/**
 * Unique within this response; s0001, s0002, ...
 */
export type Id10 = string;
export type Kind8 =
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
export type ListDepth2 = number | null;
export type ListOrdered = boolean | null;
export type ListStart1 = number | null;
export type Method = 'ocr';
export type NoteLabel2 = string | null;
export type NoteRole1 = ('footnote' | 'endnote') | null;
export type Page = number;
export type RelatedTo1 = string | null;
/**
 * @maxItems 20000
 */
export type Spans1 = RecognitionSpan[];
/**
 * Finalize this segment's exact source transcription before quoting any span. Characters and placement are separate: ordinary raised/lowered digits use ordinary text plus vertical_align; intrinsic Unicode stays exact. Every anchor/context quotes this text.
 */
export type Text1 = string;
/**
 * @maxItems 2000
 */
export type Segments = RecognitionSegment[];
export type SourceSha2568 = string;
export type TaskId8 = string;
/**
 * @maxItems 100
 */
export type Unresolved5 = string[];
/**
 * @maxItems 25000
 */
export type Responses = RecognitionResponse[];
export type SchemaVersion9 = 'ava-reconstruct-input-10';
export type SourceContinuationPolicy = 'ava-source-continuation-presentation-1';
export type SourceFeaturePolicy = 'ava-ocr-source-features-1';
export type SourceLayoutPolicy = 'ava-native-layout-1';
export type SourceNormalizationPolicy = 'ava-native-word-wrap-1';
export type SourceSha2569 = string;
export type SourceStructurePolicy = 'ava-native-structure-2';
export type SourceTitlePolicy = 'ava-frontmatter-title-1';
export type CatalogueSha256 = string;
/**
 * @minItems 1
 * @maxItems 128
 */
export type Decisions3 = [WordWrapDecision, ...WordWrapDecision[]];
export type Disposition2 = 'layout' | 'literal' | 'unresolved';
export type Id11 = string;
export type ObservationSha2566 = string;
export type SchemaVersion10 = 'ava-native-word-wrap-response-1';
export type SourceSha25610 = string;
export type TaskId9 = string;
/**
 * @maxItems 32
 */
export type WordWrapResponses = WordWrapResponse[];

export interface ContinuationReconstructionInput {
  geometry_corrections: GeometryCorrections;
  native_structure_responses: NativeStructureResponses;
  profile_id?: ProfileId;
  recognition_repair_policy: RecognitionRepairPolicy;
  refinements?: Refinements;
  responses: Responses;
  schema_version: SchemaVersion9;
  source_continuation_policy: SourceContinuationPolicy;
  source_feature_policy: SourceFeaturePolicy;
  source_layout_policy: SourceLayoutPolicy;
  source_normalization_policy: SourceNormalizationPolicy;
  source_sha256: SourceSha2569;
  source_structure_policy: SourceStructurePolicy;
  source_title_policy: SourceTitlePolicy;
  word_wrap_responses: WordWrapResponses;
}
export interface RecognitionGeometryProof {
  original_response_json: OriginalResponseJson;
  original_response_sha256: OriginalResponseSha256;
  response: RecognitionGeometryResponse;
}
export interface RecognitionGeometryResponse {
  original_response_sha256: OriginalResponseSha2561;
  original_task_id: OriginalTaskId;
  outcome: Outcome;
  patches: Patches;
  render_sha256: RenderSha256;
  schema_version: SchemaVersion;
  source_sha256: SourceSha256;
  task_id: TaskId;
  unresolved_reason?: UnresolvedReason;
}
export interface RecognitionGeometryPatch {
  box: RecognitionBox;
  segment_id: SegmentId;
}
export interface RecognitionBox {
  coordinate_space: CoordinateSpace;
  x0: X0;
  x1: X1;
  y0: Y0;
  y1: Y1;
}
export interface RecognitionCellGeometryProof {
  original_response_json: OriginalResponseJson1;
  original_response_sha256: OriginalResponseSha2562;
  response: RecognitionCellGeometryResponse;
}
export interface RecognitionCellGeometryResponse {
  original_response_sha256: OriginalResponseSha2563;
  original_task_id: OriginalTaskId1;
  outcome: Outcome1;
  patches: Patches1;
  render_sha256: RenderSha2561;
  schema_version: SchemaVersion1;
  source_sha256: SourceSha2561;
  task_id: TaskId1;
  unresolved_reason?: UnresolvedReason1;
}
export interface RecognitionCellGeometryPatch {
  box: RecognitionBox;
  slot_id: SlotId;
}
export interface NativeStructureResponse2 {
  boundary_dispositions: BoundaryDispositions;
  groups: Groups;
  language: Language;
  observation_sha256: ObservationSha256;
  references: References;
  render_sha256: RenderSha2562;
  schema_version: SchemaVersion2;
  source_sha256: SourceSha2562;
  task_id: TaskId2;
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
export interface BookRefinementResponse {
  decisions: Decisions;
  image_sha256: ImageSha256;
  joins: Joins;
  metadata_decisions?: MetadataDecisions;
  observation_sha256: ObservationSha2561;
  schema_version: SchemaVersion3;
  source_sha256: SourceSha2563;
  task_id: TaskId3;
  unresolved: Unresolved1;
}
export interface NativeRefinementDecision {
  chapter_role: ChapterRole1;
  chapter_start: ChapterStart;
  evidence_ids: EvidenceIds;
  heading_level: HeadingLevel1;
  node_id: NodeId;
  parent_id: ParentId;
  role_kind: RoleKind;
  style: Style;
  text_sha256: TextSha256;
}
export interface OcrRefinementDecision {
  chapter_role: ChapterRole2;
  chapter_start: ChapterStart1;
  evidence_ids: EvidenceIds1;
  heading_level: HeadingLevel2;
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
  id: Id8;
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
  role: Role1;
  start?: Start;
  text_sha256: TextSha2562;
}
export interface SourceFeatureResponse {
  decisions: Decisions1;
  feature_decisions: FeatureDecisions;
  image_sha256: ImageSha2561;
  joins: Joins1;
  metadata_decisions?: MetadataDecisions1;
  observation_sha256: ObservationSha2562;
  schema_version: SchemaVersion4;
  source_sha256: SourceSha2564;
  task_id: TaskId4;
  unresolved: Unresolved2;
}
export interface SourceFeatureDecision {
  features: Features;
  node_id: NodeId3;
  text_sha256: TextSha2563;
}
export interface SourceFeatureObservation {
  disposition: Disposition1;
  evidence_ids: EvidenceIds4;
  feature: Feature;
  reason: Reason;
  value: Value;
}
export interface FrontmatterTitleResponse {
  cover: FrontmatterCoverCorroboration | null;
  evidence_ids: EvidenceIds6;
  image_sha256: ImageSha2562;
  observation_sha256: ObservationSha2563;
  schema_version: SchemaVersion5;
  selected_node_id: SelectedNodeId;
  selected_text_sha256: SelectedTextSha256;
  source_sha256: SourceSha2565;
  task_id: TaskId5;
}
export interface FrontmatterCoverCorroboration {
  evidence_ids: EvidenceIds5;
  node_ids: NodeIds;
}
export interface PresentationRefinementResponse {
  decisions: Decisions2;
  image_sha256: ImageSha2563;
  joins: Joins2;
  metadata_decisions?: MetadataDecisions2;
  observation_sha256: ObservationSha2564;
  presentations: Presentations;
  schema_version: SchemaVersion6;
  source_sha256: SourceSha2566;
  task_id: TaskId6;
  unresolved: Unresolved3;
}
export interface RefinementDecision {
  chapter_role: ChapterRole3;
  chapter_start: ChapterStart2;
  evidence_ids: EvidenceIds7;
  heading_level: HeadingLevel3;
  node_id: NodeId4;
  parent_id: ParentId2;
  role_kind?: RoleKind2;
  style: RefinementStyle | null;
  text_sha256: TextSha2564;
}
export interface JoinPresentationChoice {
  candidate_id: CandidateId1;
  edge_id: EdgeId1;
  evidence_ids: EvidenceIds8;
}
export interface SourceRoleResponse {
  image_sha256: ImageSha2564;
  observation_sha256: ObservationSha2565;
  role_decisions: RoleDecisions;
  schema_version: SchemaVersion7;
  source_sha256: SourceSha2567;
  task_id: TaskId7;
  unresolved: Unresolved4;
}
export interface SourceRoleDecision {
  evidence_ids: EvidenceIds9;
  node_id: NodeId5;
  reason: Reason1;
  role: Role2;
  text_sha256: TextSha2565;
}
export interface RecognitionResponse {
  language: Language1;
  render_sha256: RenderSha2563;
  schema_version: SchemaVersion8;
  segments: Segments;
  source_sha256: SourceSha2568;
  task_id: TaskId8;
  unresolved: Unresolved5;
}
export interface RecognitionSegment1 {
  alt?: Alt;
  box: RecognitionBox;
  cells?: Cells;
  chapter_role?: ChapterRole4;
  chapter_start?: ChapterStart3;
  continues_from_previous: ContinuesFromPrevious1;
  continues_to_next: ContinuesToNext1;
  heading_level?: HeadingLevel4;
  id: Id10;
  kind: Kind8;
  list_depth?: ListDepth2;
  list_ordered?: ListOrdered;
  list_start?: ListStart1;
  method: Method;
  note_label?: NoteLabel2;
  note_role?: NoteRole1;
  page: Page;
  related_to?: RelatedTo1;
  spans: Spans1;
  style: Style1 | null;
  text: Text1;
}
export interface RecognitionCell {
  box: RecognitionBox | null;
  column_span?: ColumnSpan;
  header_axis: HeaderAxis;
  row_span?: RowSpan;
  source_cell_id?: SourceCellId;
  spans: Spans;
  style: Style1 | null;
  text: Text;
}
export interface RecognitionSpan {
  anchor?: RecognitionTextAnchor | null;
  end?: End1;
  note_label: NoteLabel1;
  start?: Start1;
  style: Style1 | null;
  target_text: TargetText;
  url: Url;
}
export interface RecognitionTextAnchor {
  after?: After;
  before?: Before;
  exact_text: ExactText;
}
export interface Style1 {
  align?: Align1;
  background_color?: BackgroundColor1;
  block_indent_em?: BlockIndentEm1;
  bold?: Bold1;
  color?: Color1;
  decoration_color?: DecorationColor1;
  family?: Family1;
  id: Id9;
  indent_em?: IndentEm1;
  italic?: Italic1;
  line_height?: LineHeight1;
  relative_size?: RelativeSize1;
  small_caps?: SmallCaps1;
  space_after_em?: SpaceAfterEm1;
  space_before_em?: SpaceBeforeEm1;
  strike_through?: StrikeThrough1;
  underline?: Underline1;
  vertical_align?: VerticalAlign1;
}
export interface WordWrapResponse {
  catalogue_sha256: CatalogueSha256;
  decisions: Decisions3;
  observation_sha256: ObservationSha2566;
  schema_version: SchemaVersion10;
  source_sha256: SourceSha25610;
  task_id: TaskId9;
}
export interface WordWrapDecision {
  disposition: Disposition2;
  id: Id11;
}
