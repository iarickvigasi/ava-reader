import { parseReview } from './review-schema';
it('records explicit admin authorization with pending review, ignoring forged review claims', () => {
  const result = parseReview(
    {
      reviewDeferred: true,
      reviewer: 'forged',
      rightsStatement: 'World cleared',
    },
    'a'.repeat(64),
    'actual-admin',
    'https://standardebooks.org/ebooks/jane-austen/emma',
  );
  expect(result).toMatchObject({
    reviewDeferred: true,
    reviewer: 'actual-admin',
    rightsJurisdiction: 'Not reviewed',
  });
  expect(result.rightsStatement).toContain('review pending');
  expect(result.notes).toContain('timestamps record authorization only');
});
it('still requires both confirmations for a completed review', () => {
  expect(() => parseReview({}, 'a'.repeat(64), 'admin')).toThrow(
    'Confirm rights',
  );
});
