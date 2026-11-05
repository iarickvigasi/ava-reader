import { validateCheckpoint } from './validate-checkpoint';

const request = {
  clientSessionId: 'client',
  startedAt: '2026-11-03T10:00:00.000Z',
  checkpointAt: '2026-11-03T10:05:00.000Z',
  timeZone: 'UTC',
  revision: 1,
  endedAt: null,
};

it.each([
  { clientSessionId: '' },
  { clientSessionId: 10 },
  { revision: 0 },
  { revision: 1.5 },
  { revision: '1' },
  { revision: Number.MAX_SAFE_INTEGER },
  { startedAt: 'invalid' },
  { checkpointAt: 'invalid' },
  { checkpointAt: '2026-11-03T09:00:00Z' },
  { endedAt: '2026-11-03T10:06:00Z' },
  { endedAt: undefined },
  { timeZone: 'invalid' },
  { timeZone: null },
])('rejects invalid checkpoint fields: %j', (invalid) => {
  expect(() =>
    validateCheckpoint({ ...request, ...invalid } as never),
  ).toThrow();
});

it('caps an overlong run at 24 hours', () => {
  const result = validateCheckpoint({
    ...request,
    checkpointAt: '2026-11-05T10:00:00Z',
  });
  expect(result.durationSeconds).toBe(86_400);
});

it('uses measured seconds regardless of the request arrival time', () => {
  expect(validateCheckpoint(request).durationSeconds).toBe(300);
});
