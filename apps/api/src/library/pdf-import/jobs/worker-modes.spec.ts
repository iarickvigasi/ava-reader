import { configuredWorkerModes } from './worker-modes';
it('registers default native or explicit live modes', () => {
  expect(configuredWorkerModes()).toEqual(['native']);
  expect(configuredWorkerModes('native,live')).toEqual(['native', 'live']);
});
it.each(['', 'live,live', 'native,unknown', 'native, live'])(
  'rejects invalid modes %s',
  (value) => {
    expect(() => configuredWorkerModes(value)).toThrow(
      'PDF_WORKER_REGISTRATION_INVALID',
    );
  },
);
