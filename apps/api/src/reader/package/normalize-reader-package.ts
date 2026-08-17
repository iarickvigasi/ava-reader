import { decodeXmlEntities } from '../../shared/xml-entities';
import type { ReaderPackage } from '../reader-types';
import { normalizeTocDisplayText } from '../toc-display-text';

type LegacyReaderTocEntry = {
  chapterId: string;
  href: string;
  label: string;
  spineIndex: number;
};

export type LegacyReaderPackage = Omit<ReaderPackage, 'toc' | 'version'> & {
  toc: LegacyReaderTocEntry[];
  version: 1;
};

export type ReaderPackageWithLegacyAuthors = Omit<ReaderPackage, 'manifest'> & {
  manifest: Omit<ReaderPackage['manifest'], 'authors'> & {
    author?: null | string;
    authors?: string[];
  };
};

// v1 stored a flat TOC array; v2 stores a tree. Lift each entry to a top-level
// node with a synthetic id so downstream code only ever sees the tree shape.
export function normalizeLegacyReaderPackage(
  readerPackage: LegacyReaderPackage,
): ReaderPackage {
  const normalizedPackage: ReaderPackageWithLegacyAuthors = {
    ...readerPackage,
    toc: readerPackage.toc.map((entry, index) => ({
      anchorId: null,
      blockId: null,
      chapterId: entry.chapterId,
      children: [],
      href: entry.href,
      id: `toc:${index}`,
      label: entry.label,
      spineIndex: entry.spineIndex,
    })),
    version: 2,
  };

  return normalizeReaderPackageManifestAuthors(normalizedPackage);
}

export function normalizeReaderPackageManifestAuthors(
  readerPackage: ReaderPackageWithLegacyAuthors,
): ReaderPackage {
  const authorCandidates = Array.isArray(readerPackage.manifest.authors)
    ? readerPackage.manifest.authors
    : typeof readerPackage.manifest.author === 'string'
      ? [readerPackage.manifest.author]
      : [];
  const authors = authorCandidates
    .map((author) => author.trim())
    .filter((author) => author.length > 0);

  return {
    ...readerPackage,
    chapters: readerPackage.chapters.map((chapter) => ({
      ...chapter,
      label: decodeXmlEntities(chapter.label),
      title: decodeXmlEntities(chapter.title),
    })),
    manifest: {
      ...readerPackage.manifest,
      authors: authors.map((author) => decodeXmlEntities(author)),
      title: decodeXmlEntities(readerPackage.manifest.title),
    },
    toc: normalizeTocDisplayText(readerPackage.toc),
  };
}
