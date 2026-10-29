import { fetchArchive } from './fetch-archive';

const originalAgent = process.env.READING_IMPORT_USER_AGENT;
beforeEach(() => {
  jest.useFakeTimers();
  process.env.READING_IMPORT_USER_AGENT = 'AVAReader/1.0 (test@example.org)';
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  if (originalAgent === undefined) delete process.env.READING_IMPORT_USER_AGENT;
  else process.env.READING_IMPORT_USER_AGENT = originalAgent;
});
it('rejects an external redirect before issuing a second request', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/private' },
    }),
  );
  const result = expect(
    fetchArchive('https://archive.org/metadata/classic', 100),
  ).rejects.toThrow('Unapproved');
  await jest.runAllTimersAsync();
  await result;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('caps the actual streamed bytes even without content-length', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response('oversized response'));
  const result = expect(
    fetchArchive('https://archive.org/metadata/classic', 5),
  ).rejects.toThrow('too large');
  await jest.runAllTimersAsync();
  await result;
});
it('honors a long Retry-After by exiting instead of retrying early', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(null, {
      status: 429,
      headers: { 'retry-after': '120' },
    }),
  );
  const result = expect(
    fetchArchive('https://archive.org/metadata/classic', 100),
  ).rejects.toThrow('rerun later');
  await jest.runAllTimersAsync();
  await result;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
