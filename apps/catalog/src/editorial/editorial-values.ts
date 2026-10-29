import { BadRequestException } from '@nestjs/common';

export function text(value: unknown, nullable = false): string | null {
  if (nullable && (value === null || value === '')) return null;
  if (
    typeof value !== 'string' ||
    value.length > 100_000 ||
    (!nullable && !value.trim())
  )
    throw new BadRequestException('Invalid text field');
  return value.trim();
}
export function rows(value: unknown): Record<string, unknown>[] {
  if (
    !Array.isArray(value) ||
    value.length > 500 ||
    value.some((row: unknown) => !row || typeof row !== 'object')
  )
    throw new BadRequestException('Invalid metadata rows');
  return value as Record<string, unknown>[];
}
export function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 500)
    throw new BadRequestException('Invalid list');
  return value
    .filter((item: unknown) => typeof item !== 'string' || !!item.trim())
    .map((item: unknown) => text(item)!);
}
export function cover(value: unknown): string | null {
  const url = text(value, true);
  if (url && !/^https:\/\//.test(url))
    throw new BadRequestException('Cover URL must use HTTPS');
  return url;
}
