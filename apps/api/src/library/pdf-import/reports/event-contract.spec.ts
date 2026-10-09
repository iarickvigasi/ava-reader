import { eventIdentity, safeEventSchema } from './event-contract';
it('rejects unknown content/credential fields rather than logging arbitrary event JSON', () => {
  expect(() =>
    safeEventSchema.parse({
      kind: 'FAILED',
      stage: 'EXTRACTION',
      details: { prompt: 'private book text', authorization: 'Bearer secret' },
    }),
  ).toThrow();
  expect(() =>
    safeEventSchema.parse({
      kind: 'FAILED',
      stage: 'EXTRACTION',
      details: { regionId: 'https://private.example/?token=key' },
    }),
  ).toThrow();
});
it('retains typed annotation coordinates without personal annotation text', () => {
  expect(
    safeEventSchema.parse({
      kind: 'ADMISSION_REFUSED',
      stage: 'ADMISSION',
      code: 'PDF_ANNOTATION_UNSUPPORTED',
      details: {
        locations: [
          { pageNumber: 3, annotationNumber: 1, relationshipPath: ['/Popup'] },
        ],
      },
    }).details.locations,
  ).toEqual([
    { pageNumber: 3, annotationNumber: 1, relationshipPath: ['/Popup'] },
  ]);
});
it('does not label an inferred interval a work duration', () => {
  expect(() =>
    safeEventSchema.parse({
      kind: 'PROGRESS',
      stage: 'EXTRACTION',
      durationMs: 10,
    }),
  ).toThrow();
});
it('canonicalizes known fields and hashes producer keys without retaining their raw input', () => {
  const a = eventIdentity('server-producer', {
    kind: 'FAILED',
    stage: 'EXTRACTION',
    severity: 'ERROR',
    details: {},
  });
  const b = eventIdentity('server-producer', {
    stage: 'EXTRACTION',
    kind: 'FAILED',
    details: {},
    severity: 'ERROR',
  });
  expect(a.payloadSha256).toBe(b.payloadSha256);
  expect(a.producerKey).not.toContain('server-producer');
});
