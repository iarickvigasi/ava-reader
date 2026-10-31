import { generateAiComment } from './generate-comment';
import { findCachedAiComment } from './find-cached-comment';
import { streamAiComment } from './stream-generation';
import { buildSourceHash } from '../source-hash';
import { buildPromptForKind } from '../prompts';
import { AiCommentKind } from '@prisma/client';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import type { PrismaService } from '../../prisma/prisma.service';

jest.mock('./find-cached-comment');
jest.mock('./stream-generation');

it('invalidates old prompt caches and keeps a regenerated request idempotent', async () => {
  jest.mocked(findCachedAiComment).mockResolvedValue(null);
  const request = {
    kind: AiCommentKind.EXPLAIN,
    text: '羅生門',
    targetLang: 'Ukrainian',
    libraryItemId: 'book',
    clerkUserId: 'clerk',
    regenerationId: 'request-1',
  };
  const args = {
    request,
    libraryItemId: 'book',
    userId: 'user',
    prisma: {} as PrismaService,
    openrouter: { getModelId: () => 'model' } as OpenRouterClient,
  };
  await generateAiComment(args);
  const first = jest.mocked(streamAiComment).mock.calls.at(-1)![0].sourceHash;
  expect(first).toBe(
    buildSourceHash({
      kind: request.kind,
      text: request.text,
      targetLang: request.targetLang,
      model: 'model',
      prompt: JSON.stringify(buildPromptForKind(request.kind, request)),
      regenerationId: 'request-1',
    }),
  );
  expect(first).not.toBe(
    buildSourceHash({
      kind: request.kind,
      text: request.text,
      targetLang: request.targetLang,
      model: 'model',
    }),
  );
  await generateAiComment(args);
  expect(
    jest.mocked(findCachedAiComment).mock.calls.at(-1)![0].sourceHash,
  ).toBe(first);
  await generateAiComment({
    ...args,
    request: { ...request, regenerationId: 'request-2' },
  });
  expect(
    jest.mocked(streamAiComment).mock.calls.at(-1)![0].sourceHash,
  ).not.toBe(first);
});
