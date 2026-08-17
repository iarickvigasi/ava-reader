import { decodeXmlEntities } from '../../shared/xml-entities';
import type { ReaderProgressSummary } from '../reader-payload-types';
import { parseLocator } from './locator';

export function createProgressSummary(
  progress: {
    chapterLabel: string | null;
    completionPercent: number;
    currentLocator: string | null;
    lastReadAt: Date | null;
  } | null,
): ReaderProgressSummary {
  return {
    chapterLabel: progress?.chapterLabel
      ? decodeXmlEntities(progress.chapterLabel)
      : null,
    completionPercent: progress?.completionPercent ?? 0,
    lastReadAt: progress?.lastReadAt?.toISOString() ?? null,
    locator: parseLocator(progress?.currentLocator ?? null),
  };
}
