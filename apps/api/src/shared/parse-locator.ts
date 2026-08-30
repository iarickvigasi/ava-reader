import { Logger } from '@nestjs/common';

// Parses a persisted `locator` column. Old rows have null. Newer rows hold a
// JSON-serialised locator. Anything that doesn't parse is treated as null
// rather than throwing — a single corrupt row shouldn't break the whole list.
// `source` names the owning record so the log line stays greppable.
const logger = new Logger('parseLocator');

export function parseLocator(raw: string | null, source: string): unknown {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    logger.error(`${source} locator JSON was not parsed: ${raw}`);
    return null;
  }
}
