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

it('uses server-funded Google Flash TTS with deliberate delivery and playable WAV', async () => {
  fetchMock.mockResolvedValue(
    new Response(new Uint8Array([1, 2]), {
      headers: { 'Content-Type': 'audio/pcm;rate=24000;channels=1' },
    }),
  );
  const audio = await synthesizeSpeech(config, 'привіт');
  expect(audio.toString('ascii', 0, 4)).toBe('RIFF');
  expect(audio.subarray(44, 46)).toEqual(Buffer.from([1, 2]));
  expect(audio.subarray(46)).toEqual(Buffer.alloc(19_200));
  const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('https://openrouter.ai/api/v1/audio/speech');
  const body = JSON.parse(request.body as string) as { instructions: string };
  expect(body).toMatchObject({
    model: 'google/gemini-3.8-flash-tts',
    input: 'привіт',
    response_format: 'pcm',
  });
  expect(body.instructions).toContain('slightly slower');
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

it('passes detected Japanese pronunciation through Google delivery instructions', async () => {
  fetchMock.mockResolvedValue(
    new Response(new Uint8Array([1, 2]), {
      headers: { 'Content-Type': 'audio/pcm;rate=24000;channels=1' },
    }),
  );
  await synthesizeSpeech(config, '生', 'ja');
  const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(request.body as string) as { instructions: string };
  expect(body).toMatchObject({
    model: 'google/gemini-3.8-flash-tts',
  });
  expect(body.instructions).toContain('natural Japanese pronunciation');
});
