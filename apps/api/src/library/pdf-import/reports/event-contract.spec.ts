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

it.each(['google-vertex/global', 'google-vertex/global/priority'])(
  'captures an immutable selected endpoint %s without confusing it with an object ID',
  (providerSlug) => {
    const event = safeEventSchema.parse({
      kind: 'PROVIDER_SETTLED',
      stage: 'PROVIDER',
      details: {
        routeSelection: {
          routeId: 'route-selected',
          providerSlug,
          modelId: 'google/gemini-3.8-flash',
          configurationSha256: 'a'.repeat(64),
          evidence: 'IMMUTABLE_ROUTE_SELECTION',
          observedProvider: 'UNKNOWN',
        },
      },
    });
    expect(event.details.routeSelection?.providerSlug).toBe(providerSlug);
  },
);
it.each([
  'https://private.example/path',
  '/private/endpoint',
  'Bearer-private',
  'sk-secret',
  'provider//endpoint',
  'provider/sk-secret',
  'provider/Bearer-private',
  'provider?token=private',
])(
  'refuses unsafe selected endpoint %s before journal persistence',
  (providerSlug) => {
    expect(() =>
      safeEventSchema.parse({
        kind: 'PROVIDER_SETTLED',
        stage: 'PROVIDER',
        details: {
          routeSelection: {
            routeId: 'route-selected',
            providerSlug,
            modelId: 'google/gemini-3.8-flash',
            configurationSha256: 'a'.repeat(64),
            evidence: 'IMMUTABLE_ROUTE_SELECTION',
            observedProvider: 'UNKNOWN',
          },
        },
      }),
    ).toThrow();
  },
);
