import { parseImportManifest } from './manifest';
import { importFixture } from './import-fixture';

it('accepts unreviewed drafts but rejects invalid attached approval', () => {
  expect(parseImportManifest(JSON.stringify(importFixture))).toEqual(
    importFixture,
  );
  for (const review of [
    { ...importFixture.review, sha256: 'c'.repeat(64) },
    { ...importFixture.review, qualityReviewedAt: '2999-01-01T00:00:00Z' },
    { ...importFixture.review, rightsJurisdiction: '' },
  ])
    expect(() =>
      parseImportManifest(JSON.stringify({ ...importFixture, review })),
    ).toThrow();
  expect(
    parseImportManifest(JSON.stringify({ ...importFixture, review: null }))
      .review,
  ).toBeNull();
});
