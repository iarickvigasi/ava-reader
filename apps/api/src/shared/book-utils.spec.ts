import { BookFileFormat } from '@prisma/client';
import { inferMimeType, normalizeBookLanguage } from './book-utils';

describe('inferMimeType', () => {
  it('returns EPUB mime type', () => {
    expect(inferMimeType(BookFileFormat.EPUB)).toBe('application/epub+zip');
  });

  it('returns PDF mime type', () => {
    expect(inferMimeType(BookFileFormat.PDF)).toBe('application/pdf');
  });

  it('returns default fallback for unknown formats', () => {
    expect(inferMimeType(BookFileFormat.UNKNOWN)).toBe(
      'application/octet-stream',
    );
  });
});

describe('normalizeBookLanguage', () => {
  it('returns null for null', () => {
    expect(normalizeBookLanguage(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeBookLanguage(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeBookLanguage('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(normalizeBookLanguage('   ')).toBeNull();
  });

  it('normalizes a standard locale', () => {
    expect(normalizeBookLanguage('en')).toBe('en');
  });

  it('normalizes an underscore locale to a hyphenated locale', () => {
    expect(normalizeBookLanguage('en_US')).toBe('en-US');
  });

  it('falls back to trimmed value for invalid locale', () => {
    expect(normalizeBookLanguage('not-a-locale')).toBe('not-a-locale');
  });

  it('trims whitespace before processing', () => {
    expect(normalizeBookLanguage('  en  ')).toBe('en');
  });
});
