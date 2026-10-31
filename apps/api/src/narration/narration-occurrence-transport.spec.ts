import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { NarrationController } from './narration.controller';
import { identifyNarrationLanguage } from './language/identify-narration-language';
import { synthesizeSpeech } from './synthesize-speech';
import { requireOwnedLibraryItem } from '../shared/owned-library-item';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
jest.mock('./language/identify-narration-language');
jest.mock('./synthesize-speech');
jest.mock('../shared/owned-library-item');
it('carries validated exact occurrence to identification and speech', async () => {
  jest
    .mocked(requireOwnedLibraryItem)
    .mockResolvedValue({ userId: 'reader', libraryItemId: 'book' });
  jest.mocked(identifyNarrationLanguage).mockResolvedValue('ja');
  jest.mocked(synthesizeSpeech).mockResolvedValue(Buffer.from([0, 0]));
  const config = new ConfigService();
  const controller = new NarrationController(
    config,
    {} as PrismaService,
    {} as UsersService,
  );
  const input = {
    text: '生',
    context: '生まれた子は元気に生きる',
    contextOffset: 9,
  };
  await controller.narrate(
    { auth: { clerkUserId: 'reader' } } as AuthenticatedRequest,
    'book',
    input,
    { set: jest.fn(), send: jest.fn() } as unknown as Response,
  );
  expect(identifyNarrationLanguage).toHaveBeenCalledWith(
    config,
    input,
    'reader',
  );
  expect(synthesizeSpeech).toHaveBeenCalledWith(
    config,
    input.text,
    'ja',
    input.context,
    9,
  );
});
