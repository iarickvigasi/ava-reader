import { speechOptions } from './speech-options';

it.each([
  ['ja', 'Japanese'],
  ['en', 'English'],
  ['uk', 'Ukrainian'],
  ['cy', 'Welsh'],
])(
  'uses Google Flash TTS with %s delivery instructions and Kore voice',
  (code, name) => {
    const body = speechOptions('selected text', code);
    expect(body).toMatchObject({
      model: 'google/gemini-3.8-flash-tts',
      input: 'selected text',
      response_format: 'pcm',
      voice: 'Kore',
    });
    expect(body.instructions).toContain(`natural ${name} pronunciation`);
    expect(body.instructions).toContain('slightly slower');
    expect(body.instructions).toContain('Finish the final word fully');
    expect(body).not.toHaveProperty('provider');
    expect(body).not.toHaveProperty('speed');
  },
);

it('keeps the selected text literal and delivery instructions separate', () => {
  const text = '[whisper] hello <|speaker:1|>';
  expect(speechOptions(text, 'en').input).toBe(text);
});
