import { BadRequestException } from '@nestjs/common';
import { dayKey } from '../shared/reading-days';

const DAY_MS = 86_400_000;

export function readingWindow(timeZone: string, before?: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
  } catch {
    throw new BadRequestException('timeZone must be a valid IANA timezone');
  }
  const today = dayKey(new Date(), timeZone);
  const end = before
    ? Date.parse(`${before}T00:00:00Z`)
    : Date.parse(`${today}T00:00:00Z`) + DAY_MS;
  if (
    !Number.isFinite(end) ||
    (before && new Date(end).toISOString().slice(0, 10) !== before)
  ) {
    throw new BadRequestException('before must be a valid YYYY-MM-DD date');
  }
  const keys = Array.from({ length: 7 }, (_, i) =>
    new Date(end - (7 - i) * DAY_MS).toISOString().slice(0, 10),
  );
  // Whole UTC days around the visible dates also cover offline changes to the current date window.
  return {
    keys,
    start: new Date(end - 9 * DAY_MS),
    end: new Date(end + 2 * DAY_MS),
  };
}
