import { speechOptions } from './speech-options';
it('uses inexpensive Flash without billed direction tags for supported languages', () => {
  const body = speechOptions('ラショウモン', 'ja');
  expect(body.model).toBe('elevenlabs/eleven-flash-v2.5');
  expect(body.input).toBe('ラショウモン');
  expect(body.provider.options.elevenlabs).toMatchObject({
    language_code: 'ja',
    voice_settings: { speed: 0.85 },
  });
});
it('preserves v4 coverage for a language Flash does not support', () => {
  expect(speechOptions('hello', 'cy').model).toBe('elevenlabs/eleven-v4');
});
