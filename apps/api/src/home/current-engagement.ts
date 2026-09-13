import { buildCoverImageUrl } from '../shared/cover-image-url';
import {
  compareByEngagementDesc,
  mostRecentEngagementDate,
} from '../shared/engagement-date';
import { findPrimarySourceFile } from '../shared/primary-book-file';
import type { LibraryItemRecord } from './types';

export function createCurrentEngagement(libraryItems: LibraryItemRecord[]) {
  const item = [...libraryItems].sort(compareByEngagementDesc)[0];
  if (!item) return { currentEngagement: null, listening: null };

  return {
    currentEngagement: serializeCurrentEngagement(item),
    listening: {
      authorLine: formatAuthors(item.book.authors),
      progressPercent: item.progress?.completionPercent ?? 0,
      title: item.book.title,
    },
  };
}

function serializeCurrentEngagement(item: LibraryItemRecord) {
  const primarySource = findPrimarySourceFile(item.book.files);

  return {
    authors: item.book.authors,
    chapterLabel: item.progress?.chapterLabel ?? 'Opening chapters',
    completionPercent: item.progress?.completionPercent ?? 0,
    coverImageUrl: item.book.coverBlob
      ? buildCoverImageUrl(item.book.id)
      : null,
    lastReadAt: mostRecentEngagementDate(item).toISOString(),
    libraryItemId: item.id,
    nextMilestone: item.progress?.chapterLabel ?? 'Continue where you left off',
    primaryFormat: primarySource?.format ?? 'UNKNOWN',
    slug: item.slug,
    title: item.book.title,
  };
}

function formatAuthors(authors: string[]) {
  return authors.length === 0 ? 'Unknown author' : authors.join(', ');
}
