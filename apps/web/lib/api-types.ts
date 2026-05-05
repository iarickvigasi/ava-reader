export type UserRole = "USER" | "ADMIN";

export type CurrentUserPayload = {
  avatarUrl: string | null;
  clerkUserId: string;
  displayName: string | null;
  email: string;
  id: string;
  role: UserRole;
};

export type BookFileFormat = "EPUB" | "PDF" | "READER_PACKAGE" | "UNKNOWN";

export type HomePayload = {
  collections: {
    items: Array<{
      description: string | null;
      id: string;
      itemCount: number;
      kind: "SMART" | "CUSTOM";
      name: string;
      smartKey: string | null;
      unreadCount: number;
    }>;
  };
  currentEngagement: null | {
    authors: string[];
    chapterLabel: string;
    completionPercent: number;
    coverImageDataUrl: string | null;
    id: string;
    lastReadAt: string;
    nextMilestone: string;
    primaryFormat: BookFileFormat;
    slug: string;
    title: string;
  };
  feedback: {
    acceptsScreenshot: boolean;
  };
  featuredCatalog: {
    entries: Array<{
      authors: string[];
      coverImageDataUrl: string | null;
      description: string | null;
      id: string;
      isFeatured: boolean;
      primaryFormat: BookFileFormat;
      title: string;
    }>;
  };
  listening: null | {
    authorLine: string;
    progressPercent: number;
    title: string;
  };
  mastery: {
    dailyGoalMinutes: number;
    days: Array<{
      goalMet: boolean;
      key: string;
      minutes: number;
    }>;
    remainingMinutes: number;
    todayMinutes: number;
  };
  recentAnnotations: {
    items: Array<{
      bookTitle: string;
      colorLabel: string;
      createdAt: string;
      excerpt: string;
      id: string;
      note: string | null;
    }>;
  };
  state: "EMPTY" | "POPULATED";
  stats: {
    aiComments: number;
    highlights: number;
    hoursReading: number;
    volumesRead: number;
  };
  user: {
    avatarUrl: string | null;
    displayName: string | null;
    email: string;
    id: string;
    role: UserRole;
  };
};

export type LibraryCollectionBook = {
  authors: string[];
  completionPercent: number;
  coverImageDataUrl: string | null;
  lastReadAt: string;
  libraryItemId: string;
  primaryFormat: BookFileFormat;
  slug: string;
  title: string;
};

export type LibraryCollection = {
  books: LibraryCollectionBook[];
  description: string | null;
  id: string;
  itemCount: number;
  kind: "SMART" | "CUSTOM";
  name: string;
  slug: string;
  smartKey: string | null;
  unreadCount: number;
};

export type LibraryPayload = {
  collections: LibraryCollection[];
  summary: {
    booksCount: number;
    collectionsCount: number;
  };
};

export type LibraryCollectionPayload = {
  collection: LibraryCollection;
};

export type LibraryBookInfo = {
  addedAt: string;
  approximatePageCount: number | null;
  authors: string[];
  chapterLabel: string | null;
  collections: Array<{
    id: string;
    kind: "SMART" | "CUSTOM";
    name: string;
    smartKey: string | null;
  }>;
  completionPercent: number;
  coverImageDataUrl: string | null;
  description: string | null;
  genres: string[];
  language: string | null;
  lastReadAt: string | null;
  libraryItemId: string;
  minutesRead: number;
  primaryFormat: BookFileFormat;
  publishedYear: number | null;
  slug: string;
  source: "IMPORTED" | "CATALOG";
  title: string;
};

export type LibraryBookInfoPayload = {
  book: LibraryBookInfo;
};

export type LibraryCollectionRenamePayload = {
  collectionId: string;
  description: string | null;
  name: string;
};

export type LibraryCollectionDeletePayload = {
  collectionId: string;
  state: "deleted";
};

export type ReaderInline =
  | {
      kind: "text";
      text: string;
      bold?: boolean;
      fontWeight?: number;
      href?: string;
      italic?: boolean;
    }
  | {
      alt: string | null;
      href?: string;
      kind: "image";
      naturalWidth?: number | null;
      src: string;
    };

export type ReaderListItem = {
  id: string;
  inlines: ReaderInline[];
  text: string;
};

export type ReaderBlockAlign = "left" | "center" | "right" | "justify";

export type ReaderBlock =
  | {
      align?: ReaderBlockAlign;
      anchorId?: string | null;
      fontSizeScale?: number;
      fontWeight?: number;
      id: string;
      inlines: ReaderInline[];
      kind: "paragraph" | "blockquote";
      text: string;
      textIndent?: number;
    }
  | {
      align?: ReaderBlockAlign;
      anchorId?: string | null;
      fontSizeScale?: number;
      fontWeight?: number;
      id: string;
      inlines: ReaderInline[];
      kind: "heading";
      level: number;
      text: string;
      textIndent?: number;
    }
  | {
      align?: ReaderBlockAlign;
      anchorId?: string | null;
      fontSizeScale?: number;
      fontWeight?: number;
      id: string;
      items: ReaderListItem[];
      kind: "list";
      ordered: boolean;
      text: string;
      textIndent?: number;
    }
  | {
      alt: string | null;
      anchorId?: string | null;
      id: string;
      kind: "image";
      src: string;
      text: string;
    };

export type ReaderTocNode = {
  anchorId: string | null;
  blockId: string | null;
  chapterId: string | null;
  children: ReaderTocNode[];
  href: string | null;
  id: string;
  label: string;
  spineIndex: number | null;
};

export type ReaderChapterPayload = {
  blocks: ReaderBlock[];
  chapterId: string;
  href: string;
  label: string;
  nextChapterId: string | null;
  previousChapterId: string | null;
  spineIndex: number;
  title: string;
};

export type ReaderLocator = {
  blockId: string;
  chapterId: string;
  textOffset: number;
};

// Position fingerprint for an AI-comment selection. Stored serialized as JSON
// in `AiComment.locator`. The (blockId, offset) pair is the primary anchor;
// contextBefore/contextAfter are the fallback when block IDs drift after a
// re-import (text-quote-selector style).
export type AiCommentLocator = {
  chapterId: string;
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
  contextBefore: string;
  contextAfter: string;
};

export type ReaderProgressPayload = {
  chapterLabel: string | null;
  completionPercent: number;
  lastReadAt: string | null;
  locator: ReaderLocator | null;
};

export type ReaderSessionPayload = {
  durationSeconds: number;
  endedAt: string | null;
  lastTrackedAt: string | null;
  sessionId: string;
  startedAt: string;
};

export type ReaderBookPayload = {
  authors: string[];
  libraryItemId: string;
  primaryFormat: BookFileFormat;
  slug: string;
  title: string;
};

export type ReaderStatusPayload =
  | {
      activeChapterId: string;
      book: ReaderBookPayload;
      chapters: ReaderChapterPayload[];
      progress: ReaderProgressPayload;
      status: "READY";
      toc: ReaderTocNode[];
    }
  | {
      book: ReaderBookPayload;
      message: string;
      progress: ReaderProgressPayload;
      status: "FAILED" | "PROCESSING" | "UNSUPPORTED";
    };

export type AdminCatalogEntry = {
  book: {
    authors: string[];
    coverImageDataUrl: string | null;
    description: string | null;
    hasSourceFile: boolean;
    id: string;
    primaryFormat: BookFileFormat;
    title: string;
  };
  createdAt: string;
  curatorNote: string | null;
  editorialDescription: string | null;
  editorialTitle: string | null;
  featuredRank: number | null;
  id: string;
  isFeatured: boolean;
  sortOrder: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
};
