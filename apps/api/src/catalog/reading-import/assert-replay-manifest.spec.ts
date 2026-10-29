import { assertReplayManifest } from './assert-replay-manifest';
import { importFixture } from './import-fixture';

it('does not reuse the same bytes as a different language or broaden their approved scope', () => {
  expect(() =>
    assertReplayManifest(importFixture, importFixture),
  ).not.toThrow();
  expect(() =>
    assertReplayManifest(importFixture, { ...importFixture, language: 'fr' }),
  ).toThrow('differs');
  expect(() =>
    assertReplayManifest(importFixture, {
      ...importFixture,
      review: { ...importFixture.review, rightsJurisdiction: 'Worldwide' },
    }),
  ).toThrow('differs');
});
