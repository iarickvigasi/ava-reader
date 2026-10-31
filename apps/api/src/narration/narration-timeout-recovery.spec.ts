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
const speak = jest.mocked(synthesizeSpeech);
const controller = new NarrationController(
  new ConfigService(),
  {} as PrismaService,
  {} as UsersService,
);
const send = jest.fn();
const response = { set: jest.fn(), send } as unknown as Response;
let scope = 0;
beforeEach(() => {
  jest.resetAllMocks();
  scope++;
  jest
    .mocked(requireOwnedLibraryItem)
    .mockResolvedValue({ userId: 'reader', libraryItemId: 'book' });
});
const request = () =>
  ({
    auth: { clerkUserId: `timeout-controller-${scope}` },
  }) as AuthenticatedRequest;
const timeout = () => new DOMException('Timed out', 'TimeoutError');

it('retries detection but issues exactly one paid speech request', async () => {
  decide.mockRejectedValueOnce(timeout()).mockResolvedValueOnce({
    choice: 'ja',
    probabilities: { ja: 0.99, unknown: 0.01 },
  });
  speak.mockResolvedValue(Buffer.from([1, 2]));
  await controller.narrate(
    request(),
    'book',
    { text: '羅生門', context: '或日の暮方の事である。' },
    response,
  );
  expect(decide).toHaveBeenCalledTimes(2);
  expect(speak).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(Buffer.from([1, 2]));
});

it('does not generate speech after both language attempts time out', async () => {
  decide.mockRejectedValueOnce(timeout()).mockRejectedValueOnce(timeout());
  await expect(
    controller.narrate(request(), 'book', { text: '羅生門' }, response),
  ).rejects.toMatchObject({ status: 503 });
  expect(decide).toHaveBeenCalledTimes(2);
  expect(speak).not.toHaveBeenCalled();
});

it('does not start paid speech if the client disconnects during recovery', async () => {
  let finish!: (
    answer: Awaited<ReturnType<typeof requestLanguageDecision>>,
  ) => void;
  let started!: () => void;
  const recoveryStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  decide.mockRejectedValueOnce(timeout()).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
        started();
      }),
  );
  const disconnected = { destroyed: false };
  const pending = controller.narrate(
    request(),
    'book',
    { text: '羅生門' },
    disconnected as Response,
  );
  await recoveryStarted;
  disconnected.destroyed = true;
  finish({ choice: 'ja', probabilities: { ja: 0.99, unknown: 0.01 } });
  await pending;
  expect(speak).not.toHaveBeenCalled();
});
