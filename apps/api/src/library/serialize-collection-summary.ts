import type { CollectionKind } from '@prisma/client';
import {
  isBookFinished,
  serializeCompletionItem,
} from '../shared/book-completion';

type SummaryCollection = {
  description: string | null;
  id: string;
  kind: CollectionKind;
  name: string;
  slug: string | null;
  smartKey: string | null;
};

type SummaryItem = {
  id: string;
  finishedAt: Date | null;
  progress: { completionPercent: number } | null;
};

// The collection summary shape shared by the overview sections and the
// collection page. itemCount/unreadCount cover every active item, not just
// the preview cards. A book is unread only while it has no finish date and
// its reader progress is below 100%.
export function serializeCollectionSummary<Book>(input: {
  activeItems: SummaryItem[];
  books: Book[];
  collection: SummaryCollection;
}) {
  return {
    books: input.books,
    completionItems: input.activeItems.map(serializeCompletionItem),
    description: input.collection.description,
    id: input.collection.id,
    itemCount: input.activeItems.length,
    kind: input.collection.kind,
    name: input.collection.name,
    slug: input.collection.slug,
    smartKey: input.collection.smartKey,
    unreadCount: input.activeItems.filter((item) => !isBookFinished(item))
      .length,
  };
}
