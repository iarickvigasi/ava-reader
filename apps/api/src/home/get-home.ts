import type { PrismaService } from '../prisma/prisma.service';
import { selectHomeCollections } from './collections-panel';
import { createCurrentEngagement } from './current-engagement';
import { loadHomeActivity } from './load-home-activity';
import { loadHomeCatalog } from './load-home-catalog';
import { loadHomeCollections } from './load-home-collections';
import { loadHomeLibraryItems } from './load-home-library-items';
import { loadRecentAnnotations } from './load-recent-annotations';
import { createMasteryPayload } from './mastery-payload';
import type { HomeUser } from './types';

export async function getHome(options: {
  prisma: PrismaService;
  user: HomeUser;
}) {
  const { prisma, user } = options;
  const [
    libraryItems,
    featuredCatalogEntries,
    activity,
    collections,
    preferences,
  ] = await Promise.all([
    loadHomeLibraryItems(prisma, user.id),
    loadHomeCatalog(prisma),
    loadHomeActivity(prisma, user.id),
    loadHomeCollections(prisma, user.id),
    prisma.userPreferences.findUnique({
      where: { userId: user.id },
      select: { readingGoalMinutes: true },
    }),
  ]);

  const engagement = createCurrentEngagement(libraryItems);
  const annotations = await loadRecentAnnotations({
    prisma,
    userId: user.id,
    libraryItems,
  });

  return {
    collections: { items: selectHomeCollections(collections) },
    completionItems: activity.completionItems,
    currentEngagement: engagement.currentEngagement,
    feedback: { acceptsScreenshot: true },
    featuredCatalog: { entries: featuredCatalogEntries },
    listening: engagement.listening,
    mastery: createMasteryPayload(
      activity.recentReadingSessions,
      preferences?.readingGoalMinutes,
    ),
    recentAnnotations: { items: annotations },
    state: libraryItems.length > 0 ? 'POPULATED' : 'EMPTY',
    stats: activity.stats,
    user: {
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
      email: user.primaryEmail,
      id: user.id,
      role: user.role,
    },
  };
}
