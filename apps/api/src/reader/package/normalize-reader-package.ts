import { decodeXmlEntities } from '../../shared/xml-entities';
import type { ReaderPackage } from '../reader-types';
import { normalizeTocDisplayText } from '../toc-display-text';

export type ReaderPackageWithLegacyAuthors = Omit<ReaderPackage, 'manifest'> & {
  manifest: Omit<ReaderPackage['manifest'], 'authors'> & {
    author?: null | string;
    authors?: string[];
  };
};

export function normalizeReaderPackageMetadata(
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
