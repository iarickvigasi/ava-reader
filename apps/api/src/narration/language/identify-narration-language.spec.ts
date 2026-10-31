import { ConfigService } from '@nestjs/config';
import { identifyNarrationLanguage } from './identify-narration-language';
import { requestLanguageDecision } from './request-language-decision';

jest.mock('./request-language-decision');
const decide = jest.mocked(requestLanguageDecision);
const config = new ConfigService();
let scope = 0;
beforeEach(() => {
  jest.resetAllMocks();
  scope++;
});
const account = () => `language-test-${scope}`;
const answer = (choice: string, probability = 0.98) => ({
  choice,
  probabilities: { [choice]: probability, unknown: 1 - probability },
});

it('uses Japanese sentence context for a Han-only selection', async () => {
  decide.mockResolvedValue(answer('ja'));
  const input = {
    text: '生',
    context: '彼は生の魚を食べた。',
    languageHint: 'ja',
  };
  await expect(
    identifyNarrationLanguage(config, input, account()),
  ).resolves.toBe('ja');
  expect(decide).toHaveBeenCalledWith(config, input);
});

it('allows French inside English prose regardless of book hint', async () => {
  decide.mockResolvedValue(answer('fr'));
  await expect(
    identifyNarrationLanguage(
      config,
      {
        text: 'bonsoir',
        context: 'She greeted him with bonsoir.',
        languageHint: 'en',
      },
      account(),
    ),
  ).resolves.toBe('fr');
});

it('uses the kana fast path only for Japanese-script selections', async () => {
  await expect(
    identifyNarrationLanguage(config, { text: 'こんにちは。' }, account()),
  ).resolves.toBe('ja');
  expect(decide).not.toHaveBeenCalled();
  decide.mockResolvedValue({
    choice: 'ja',
    probabilities: { ja: 0.55, fr: 0.45 },
  });
  await expect(
    identifyNarrationLanguage(
      config,
      { text: 'こんにちは bonjour' },
      account(),
    ),
  ).resolves.toBe('ja');
  expect(decide).toHaveBeenCalledTimes(1);
});

it('accepts the highest score despite a narrow margin', async () => {
  decide.mockResolvedValue({
    choice: 'fr',
    probabilities: { fr: 0.55, en: 0.45 },
  });
  await expect(
    identifyNarrationLanguage(config, { text: 'chat' }, account()),
  ).resolves.toBe('fr');
});

it('routes kana plus Han quotations through the contextual model', async () => {
  decide.mockResolvedValue({
    choice: 'ja',
    probabilities: { ja: 0.51, zh: 0.49 },
  });
  await expect(
    identifyNarrationLanguage(
      config,
      { text: '彼は「你好」と言った。' },
      account(),
    ),
  ).resolves.toBe('ja');
  expect(decide).toHaveBeenCalledTimes(1);
});
