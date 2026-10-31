import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { NarrationController } from './narration.controller';
import { requestLanguageDecision } from './language/request-language-decision';
import { requireOwnedLibraryItem } from '../shared/owned-library-item';
import { synthesizeSpeech } from './synthesize-speech';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

jest.mock('./language/request-language-decision');
jest.mock('../shared/owned-library-item');
jest.mock('./synthesize-speech');
const decide = jest.mocked(requestLanguageDecision);

it('narrates kanji with the reproduced winning score of 0.63 instead of rejecting playback', async () => {
  jest
    .mocked(requireOwnedLibraryItem)
    .mockResolvedValue({ userId: 'reader', libraryItemId: 'book' });
  decide.mockResolvedValue({
    choice: 'ja',
    probabilities: { ja: 0.63, en: 0.35, unknown: 0.02 },
  });
  jest.mocked(synthesizeSpeech).mockResolvedValue(Buffer.from([1, 2]));
  const controller = new NarrationController(
    new ConfigService(),
    {} as PrismaService,
    {} as UsersService,
  );
  const context =
    'The text was taken from a 1917 edition which is naturally written in the traditional orthography with prewar kanji forms.';
  const send = jest.fn();
  await controller.narrate(
    { auth: { clerkUserId: 'top-score-reader' } } as AuthenticatedRequest,
    'book',
    { text: 'kanji', context, languageHint: 'ja' },
    { set: jest.fn(), send } as unknown as Response,
  );
  expect(synthesizeSpeech).toHaveBeenCalledWith(
    expect.any(ConfigService),
    'kanji',
    'ja',
    context,
    undefined,
  );
  expect(send).toHaveBeenCalledWith(Buffer.from([1, 2]));
});
