import type { LibraryCardBook } from "./library";
import type { BookFileFormat } from "./shared";
import type { UserRole } from "./user";

// Home's hero "Continue reading" card. Extends LibraryCardBook so the same
// minimum shape is shared with library + collection cards — any drift would
// fail typecheck instead of silently diverging.
export type CurrentEngagement = LibraryCardBook & {
  chapterLabel: string;
  lastReadAt: string;
  nextMilestone: string;
};

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
  currentEngagement: CurrentEngagement | null;
  feedback: {
    acceptsScreenshot: boolean;
  };
  featuredCatalog: {
    entries: Array<{
      authors: string[];
      coverImageUrl: string | null;
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
