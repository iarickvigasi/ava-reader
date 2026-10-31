import { identifyNarrationLanguage } from './language/identify-narration-language';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { NarrationController, narrationSchema } from './narration.controller';
import { requireOwnedLibraryItem } from '../shared/owned-library-item';
import { synthesizeSpeech } from './synthesize-speech';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';

jest.mock('../shared/owned-library-item');
jest.mock('./synthesize-speech');
jest.mock('./language/identify-narration-language');
const language = jest.mocked(identifyNarrationLanguage);
const owned = jest.mocked(requireOwnedLibraryItem);
const speak = jest.mocked(synthesizeSpeech);
const controller = new NarrationController(
  new ConfigService(),
  {} as PrismaService,
  {} as UsersService,
);
const request = { auth: { clerkUserId: 'reader' } } as AuthenticatedRequest;
const setHeaders = jest.fn();
const response = { set: setHeaders, send: jest.fn() } as unknown as Response;
beforeEach(() => jest.resetAllMocks());

it('guards narration with Clerk authentication', () => {
  expect(Reflect.getMetadata('__guards__', NarrationController)).toContain(
    ClerkAuthGuard,
  );
});

it('refuses non-owned books before any paid request', async () => {
  owned.mockRejectedValue(new Error('not owned'));
  await expect(
    controller.narrate(request, 'other-book', { text: 'hello' }, response),
  ).rejects.toThrow('not owned');
  expect(speak).not.toHaveBeenCalled();
  expect(language).not.toHaveBeenCalled();
});

it('returns private MP3 after ownership succeeds', async () => {
  owned.mockResolvedValue({ userId: 'reader', libraryItemId: 'book' });
  speak.mockResolvedValue(Buffer.from([1, 2]));
  language.mockResolvedValue('en');
  await controller.narrate(request, 'book', { text: ' hello ' }, response);
  expect(speak).toHaveBeenCalledWith(expect.any(ConfigService), 'hello', 'en');
  expect(setHeaders).toHaveBeenCalledWith({
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'private, no-store',
  });
});

it.each(['', '  ', 'x'.repeat(2049)])(
  'refuses empty/oversized text',
  (text) => {
    expect(narrationSchema.safeParse({ text }).success).toBe(false);
  },
);

it('does not synthesize when context language is uncertain', async () => {
  owned.mockResolvedValue({ userId: 'reader', libraryItemId: 'book' });
  language.mockRejectedValue(new Error('uncertain'));
  await expect(
    controller.narrate(
      request,
      'book',
      { text: 'Gift', context: 'Gift', languageHint: 'en' },
      response,
    ),
  ).rejects.toThrow('uncertain');
  expect(speak).not.toHaveBeenCalled();
});
