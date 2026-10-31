import { ConfigService } from '@nestjs/config';
import { requestLanguageDecision } from './request-language-decision';
const originalFetch = global.fetch;
const fetchMock = jest.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
});
afterAll(() => {
  global.fetch = originalFetch;
});

it('uses the Decisions endpoint with a fragment-specific bounded choice', async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        answers: {
          language: {
            choice: 'ja',
            probabilities: { ja: 0.99, zh: 0.01 },
            confidence: 0.9,
          },
        },
      }),
    ),
  );
  const config = new ConfigService({
    OPENROUTER_API_KEY: 'server-key',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1/',
  });
  const input = {
    text: '生',
    context: '彼は生の魚を食べた。',
    languageHint: 'ja',
  };
  const result = await requestLanguageDecision(config, input);
  expect(result.choice).toBe('ja');
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
  const body = JSON.parse(init.body as string) as {
    model: string;
    state: unknown;
    questions: { language: { criteria: Record<string, string> } };
  };
  expect(body.model).toBe('typesafe/jev-1.14');
  expect(body.state).toEqual({
    selectedFragment: input.text,
    sentenceContext: input.context,
    languageHint: 'ja',
  });
  expect(body.questions.language.criteria).not.toHaveProperty('unknown');
  expect(body.questions.language.criteria).not.toHaveProperty('mixed');
  expect(body.questions.language.criteria).toHaveProperty('ja');
});

it.each([
  {},
  { answers: { language: { choice: 'ja', probabilities: { ja: 4 } } } },
])('rejects malformed provider output', async (body) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));
  await expect(
    requestLanguageDecision(new ConfigService({ OPENROUTER_API_KEY: 'key' }), {
      text: '生',
    }),
  ).rejects.toThrow();
});
