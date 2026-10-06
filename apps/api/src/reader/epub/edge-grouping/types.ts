import type { ReaderPackage } from '../../reader-types';

export const EDGE_GROUPING_VERSION = 3;

export type EdgeRole =
  | 'front'
  | 'contents'
  | 'footnote'
  | 'appendix'
  | 'back'
  | 'unknown';
export type SourceSection = { role: EdgeRole; evidence: string };
export type EdgeGroup = {
  label: string;
  chapterIds: string[];
};
export type EdgePackage = ReaderPackage & { edgeGroupingVersion?: number };
