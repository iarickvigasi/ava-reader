import type { ImportRecord } from '#catalog-client';
import { skippedOutcome } from './skipped-outcome';
it('keeps safe-addition conflicts reviewable while retrying unresolved dependencies', () => {
  const record = {
    diagnostic:
      'Enriched; preserved conflicting fields: originalTitle; missing author references',
  } as ImportRecord;
  expect(skippedOutcome(record, true)).toMatchObject({
    status: 'UNRESOLVED',
    diagnostic: record.diagnostic,
  });
  expect(skippedOutcome(record, false)).toMatchObject({
    status: 'CONFLICT',
    diagnostic: record.diagnostic,
  });
});
it('leaves ordinary unchanged revisions skipped', () => {
  expect(skippedOutcome({ diagnostic: null } as ImportRecord)).toEqual({
    status: 'SKIPPED',
    diagnostic: null,
  });
});
