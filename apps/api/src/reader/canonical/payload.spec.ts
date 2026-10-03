import { canonicalReaderPayload } from './payload';
import { fixture } from './test-fixture';
it('delivers the identical canonical graph and mutable display envelope', () => {
  const { item, accepted } = fixture();
  const payload = canonicalReaderPayload(item, accepted, 'chapter-two');
  expect(payload.status).toBe('READY');
  if (payload.status !== 'READY') return;
  expect(payload.readerPackage).toBe(accepted.readerPackage);
  expect(payload.book.title).toBe('Edited title');
  expect(payload.chapters).toEqual([]);
  expect(payload.resourceUrls).toEqual(accepted.resourceUrls);
  expect(payload.activeChapterId).toBe('chapter-two');
});
it('fails a missing requested chapter instead of silently opening chapter one', () => {
  const { item, accepted } = fixture();
  expect(() => canonicalReaderPayload(item, accepted, 'missing')).toThrow(
    'chapter',
  );
  expect(canonicalReaderPayload(item, accepted)).toMatchObject({
    activeChapterId: 'chapter-one',
  });
});
