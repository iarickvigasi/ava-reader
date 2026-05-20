import type { BookFileFormat } from "./shared";
import type { UserRole } from "./user";

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
