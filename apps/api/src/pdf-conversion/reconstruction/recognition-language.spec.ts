import { recognitionResponse } from './recognition-response';
import { task, response } from './test-fixture';

it('accepts Ukrainian only for the extended dispatched task and refuses unsupported language', () => {
  const output = (language: string) =>
    JSON.stringify({ ...response, language });
  const extended = { ...task, profile_id: 'ava-pdf-prose-en-uk-v3' as const };
  expect(recognitionResponse(extended, output('uk-UA')).language).toBe('uk-UA');
  expect(() => recognitionResponse(task, output('uk'))).toThrow(
    'UNSUPPORTED_PDF',
  );
  for (const language of ['ru', 'fr', 'unknown'])
    expect(() => recognitionResponse(extended, output(language))).toThrow(
      'UNSUPPORTED_PDF',
    );
});
