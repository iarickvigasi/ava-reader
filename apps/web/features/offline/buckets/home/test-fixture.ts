import type { HomePayload } from "@/lib/api-types/home";
import type { CompletionItem } from "@/lib/api-types/library";

export const finishDate = "2026-09-13T12:00:00.000Z";
export const trackedId = "lib-1";
export const completion = (libraryItemId: string, completionPercent = 40, finishedAt: string | null = null): CompletionItem => ({
  libraryItemId, completionPercent, finishedAt,
});

export function homeFixture(): HomePayload {
  const items = [
    completion(trackedId),
    completion("remote-dated", 20, finishDate),
    completion("remote-at-end", 100),
    completion("remote-unread", 10),
    completion("archived-book", 50, finishDate),
  ];
  return {
    completionItems: items,
    collections: { items: [{
      id: "collection-1", slug: "favorites", name: "Favorites", description: null,
      kind: "CUSTOM", smartKey: null, itemCount: 4, unreadCount: 2,
      completionItems: items.slice(0, 4),
    }] },
    currentEngagement: null,
    feedback: { acceptsScreenshot: true },
    featuredCatalog: { entries: [] },
    listening: null,
    mastery: { dailyGoalMinutes: 30, days: [], remainingMinutes: 30, todayMinutes: 0 },
    recentAnnotations: { items: [] },
    state: "EMPTY",
    stats: { aiComments: 0, highlights: 0, hoursReading: 0, volumesRead: 3 },
    user: { id: "user-1", displayName: "Reader", email: "reader@example.test", avatarUrl: null, role: "USER" },
  };
}
