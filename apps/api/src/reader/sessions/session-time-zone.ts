import { BadRequestException } from '@nestjs/common';

export function sessionTimeZone(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value) {
    throw new BadRequestException('timeZone must be a valid IANA timezone');
  }
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions()
      .timeZone;
  } catch {
    throw new BadRequestException('timeZone must be a valid IANA timezone');
  }
}
