import { ConfigService } from '@nestjs/config';
import { synthesizeSpeech } from './synthesize-speech';

const config = new ConfigService({ OPENROUTER_API_KEY: 'server-only-key' });
const fetchMock = jest.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
});
afterAll(() => {
  global.fetch = originalFetch;
});

it('uses server-funded v4 with deliberate delivery and playable MP3', async () => {
  fetchMock.mockResolvedValue(
    new Response(new Uint8Array([1, 2]), {
      headers: { 'Content-Type': 'audio/mpeg' },
    }),
  );
  expect(await synthesizeSpeech(config, 'привіт')).toEqual(Buffer.from([1, 2]));
  const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('https://openrouter.ai/api/v1/audio/speech');
  expect(JSON.parse(request.body as string)).toMatchObject({
    model: 'elevenlabs/eleven-v4',
    input: '[slowly] [clearly] привіт',
    voice: 'alice',
    response_format: 'mp3',
  });
  expect(request.headers).toHaveProperty(
    'Authorization',
    'Bearer server-only-key',
  );
});

it.each([401, 429, 500])('sanitizes upstream error %s', async (status) => {
  fetchMock.mockResolvedValue(
    new Response('secret upstream detail', { status }),
  );
  await expect(synthesizeSpeech(config, 'hello')).rejects.toThrow(
    'Narration service could not prepare audio. Please try again.',
  );
});

it('rejects missing credentials without requesting speech', async () => {
  await expect(synthesizeSpeech(new ConfigService(), 'hello')).rejects.toThrow(
    'unavailable',
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(['application/json', 'audio/mpeg'])(
  'rejects empty or non-audio %s',
  async (type) => {
    fetchMock.mockResolvedValue(
      new Response('', { headers: { 'Content-Type': type } }),
    );
    await expect(synthesizeSpeech(config, 'hello')).rejects.toThrow(
      'Narration service',
    );
  },
);

it('passes the detected language through ElevenLabs provider options', async () => {
  fetchMock.mockResolvedValue(
    new Response(new Uint8Array([1]), {
      headers: { 'Content-Type': 'audio/mpeg' },
    }),
  );
  await synthesizeSpeech(config, '生', 'ja');
  const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(JSON.parse(request.body as string)).toMatchObject({
    provider: { options: { elevenlabs: { language_code: 'ja' } } },
  });
});
