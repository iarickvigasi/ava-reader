import { CatalogStatus } from '@prisma/client';

export function parseCatalogStatus(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return CatalogStatus.DRAFT;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === CatalogStatus.PUBLISHED) {
    return CatalogStatus.PUBLISHED;
  }

  if (normalized === CatalogStatus.ARCHIVED) {
    return CatalogStatus.ARCHIVED;
  }

  return CatalogStatus.DRAFT;
}
