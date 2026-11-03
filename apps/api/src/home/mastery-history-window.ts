import { BadRequestException } from '@nestjs/common';

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

export function masteryHistoryWindow(before: string) {
  const end = new Date(`${before}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(before) ||
    !Number.isFinite(end.getTime()) ||
    end.toISOString().slice(0, 10) !== before
  ) {
    throw new BadRequestException('before must be a valid YYYY-MM-DD date');
  }
  const start = new Date(end.getTime() - WEEK_DAYS * DAY_MS);
  const days = Array.from({ length: WEEK_DAYS }, (_, index) =>
    new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10),
  );
  return { start, end, days };
}
