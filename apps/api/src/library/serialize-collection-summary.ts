import type { CollectionKind } from '@prisma/client';

type SummaryCollection = {
  description: string | null;
  id: string;
  kind: CollectionKind;
  name: string;
  slug: string | null;
  smartKey: string | null;
};

type SummaryItem = {
  progress: { completionPercent: number } | null;
};

// The collection summary shape shared by the overview sections and the
// collection page. itemCount/unreadCount cover every active item, not just
// the preview cards; "unread" = completionPercent < 100 (specs/18 clamps the
// percent so back-matter can't strand a finished book here).
export function serializeCollectionSummary<Book>(input: {
  activeItems: SummaryItem[];
  books: Book[];
  collection: SummaryCollection;
}) {
  return {
    books: input.books,
    description: input.collection.description,
    id: input.collection.id,
    itemCount: input.activeItems.length,
    kind: input.collection.kind,
    name: input.collection.name,
    slug: input.collection.slug,
    smartKey: input.collection.smartKey,
    unreadCount: input.activeItems.filter(
      (item) => (item.progress?.completionPercent ?? 0) < 100,
    ).length,
  };
}
