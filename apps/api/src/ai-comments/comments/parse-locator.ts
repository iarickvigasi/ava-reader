import { Logger } from '@nestjs/common';

// Parses the persisted `locator` column. Old rows have null. Newer rows hold
// a JSON-serialised AiCommentLocator. Anything that doesn't parse is treated
// as null rather than throwing — a single corrupt row shouldn't break the
// whole list.
const logger = new Logger('parseLocator');

export function parseLocator(raw: string | null): unknown {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    logger.error(`AiCommentLocator JSON was not parsed: ${raw}`);
    return null;
  }
}
