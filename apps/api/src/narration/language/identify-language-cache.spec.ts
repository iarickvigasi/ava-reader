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
const account = () => `cache-test-${scope}`;
const answer = (choice: string) => ({
  choice,
  probabilities: { [choice]: 0.98, unknown: 0.02 },
});
it('coalesces repeats but separates contexts and accounts', async () => {
  decide.mockResolvedValue(answer('de'));
  const input = { text: 'Gift', context: 'Das Gift ist gefährlich.' };
  await Promise.all([
    identifyNarrationLanguage(config, input, account()),
    identifyNarrationLanguage(config, input, account()),
  ]);
  expect(decide).toHaveBeenCalledTimes(1);
  await identifyNarrationLanguage(
    config,
    { ...input, context: 'A gift for you.' },
    account(),
  );
  await identifyNarrationLanguage(config, input, account() + '-other');
  expect(decide).toHaveBeenCalledTimes(3);
});

it('does not cache failed classification or fall back to book language', async () => {
  decide
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce(answer('fr'));
  const input = { text: 'bonjour', languageHint: 'en' };
  await expect(
    identifyNarrationLanguage(config, input, account()),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    identifyNarrationLanguage(config, input, account()),
  ).resolves.toBe('fr');
});
