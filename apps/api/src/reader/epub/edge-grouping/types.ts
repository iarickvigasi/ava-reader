import type { ReaderPackage } from '../../reader-types';

export const EDGE_GROUPING_VERSION = 2;

export type EdgeRole = 'front' | 'contents' | 'footnote' | 'back' | 'unknown';
export type SourceSection = { role: EdgeRole; evidence: string };
export type EdgeGroup = {
  label: 'Front matter' | 'Footnotes';
  chapterIds: string[];
};
export type EdgePackage = ReaderPackage & { edgeGroupingVersion?: number };
