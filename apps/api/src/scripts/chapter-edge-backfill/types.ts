import type { ReaderPackage } from '../../reader/reader-types';

export type EdgeRole = 'front' | 'contents' | 'footnote' | 'back' | 'unknown';
export type SourceSection = { role: EdgeRole; evidence: string };
export type EdgeGroup = {
  label: 'Front matter' | 'Footnotes';
  chapterIds: string[];
};
export type EdgePackage = ReaderPackage & { edgeGroupingVersion?: number };
