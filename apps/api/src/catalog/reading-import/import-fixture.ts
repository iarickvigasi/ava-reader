import type { ImportManifest } from './manifest';

export const importFixture = {
  editionId: '12345678-1234-4234-9234-123456789012',
  workId: '12345678-1234-4234-9234-123456789013',
  externalId: '/books/OL1M',
  sourceRevision: '1',
  sourcePayloadHash: 'a'.repeat(64),
  title: 'Pride and Prejudice',
  authors: ['Jane Austen'],
  language: 'en',
  iaIdentifier: 'classic',
  filename: 'classic.epub',
  checksum: 'b'.repeat(64),
  metadata: {},
  fileMetadata: {},
  inspectedAt: '2026-01-01T00:00:00Z',
  review: {
    sha256: 'b'.repeat(64),
    reviewer: 'Curator',
    rightsStatement: 'Edition reviewed',
    rightsUrl: 'https://archive.org/details/classic',
    rightsJurisdiction: 'US',
    reviewedAt: '2026-01-01T00:00:00Z',
    qualityReviewedAt: '2026-01-01T00:00:00Z',
    notes: 'Compared opening/middle/end',
  },
} satisfies ImportManifest;
