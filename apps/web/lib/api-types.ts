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
      unreadCount: number;
    }>;
  };
  currentEngagement: null | {
    author: string | null;
    chapterLabel: string;
    completionPercent: number;
    coverImageDataUrl: string | null;
    id: string;
    lastReadAt: string;
    nextMilestone: string;
    primaryFormat: BookFileFormat;
    title: string;
  };
  feedback: {
    acceptsScreenshot: boolean;
  };
  featuredCatalog: {
    entries: Array<{
      author: string | null;
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
      dayLabel: string;
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

export type LibraryMutationPayload = {
  addedAt: string;
  book: {
    author: string | null;
    format: BookFileFormat;
    id: string;
    title: string;
  };
  libraryItemId: string;
  source: "IMPORTED" | "CATALOG";
  state: "added" | "existing";
};

export type AdminCatalogEntry = {
  book: {
    author: string | null;
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
