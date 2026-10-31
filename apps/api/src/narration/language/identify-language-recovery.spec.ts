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
const input = {
  text: '生',
  context: '彼は生の魚を食べた。',
  languageHint: 'ja',
};
const account = () => `recovery-${scope}`;
const timeout = () => new DOMException('Timed out', 'TimeoutError');
const japanese = { choice: 'ja', probabilities: { ja: 0.99, unknown: 0.01 } };

it('recovers one timeout inside the shared decision and caches the successful result', async () => {
  decide.mockRejectedValueOnce(timeout()).mockResolvedValueOnce(japanese);
  await expect(
    Promise.all([
      identifyNarrationLanguage(config, input, account()),
      identifyNarrationLanguage(config, input, account()),
    ]),
  ).resolves.toEqual(['ja', 'ja']);
  expect(decide).toHaveBeenCalledTimes(2);
  await identifyNarrationLanguage(config, input, account());
  expect(decide).toHaveBeenCalledTimes(2);
});

it('stops after two timeouts and permits a fresh explicit retry', async () => {
  decide.mockRejectedValueOnce(timeout()).mockRejectedValueOnce(timeout());
  const pending = identifyNarrationLanguage(config, input, account());
  await expect(pending).rejects.toMatchObject({ status: 503 });
  await pending.catch((error: { getResponse: () => unknown }) => {
    expect(error.getResponse()).toMatchObject({ code: 'NARRATION_TIMEOUT' });
  });
  expect(decide).toHaveBeenCalledTimes(2);
  decide.mockResolvedValueOnce(japanese);
  await expect(
    identifyNarrationLanguage(config, input, account()),
  ).resolves.toBe('ja');
  expect(decide).toHaveBeenCalledTimes(3);
});

it.each(['AbortError', 'TypeError', 'Error'])(
  'does not retry %s',
  async (name) => {
    decide.mockRejectedValueOnce(
      Object.assign(new Error('Unavailable'), { name }),
    );
    await expect(
      identifyNarrationLanguage(config, input, account()),
    ).rejects.toMatchObject({ status: 503 });
    expect(decide).toHaveBeenCalledTimes(1);
  },
);

it('uses the highest score after timeout recovery', async () => {
  decide.mockRejectedValueOnce(timeout()).mockResolvedValueOnce({
    choice: 'ja',
    probabilities: { ja: 0.5, zh: 0.5 },
  });
  await expect(
    identifyNarrationLanguage(config, input, account()),
  ).resolves.toBe('ja');
  expect(decide).toHaveBeenCalledTimes(2);
});
