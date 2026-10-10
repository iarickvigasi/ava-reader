import type { PdfProviderRoute } from '@prisma/client';
import type { ProviderTask } from './types';
import { jsonHash } from './hash';
import { checksumBuffer } from '../../../shared/blob-utils';
export const task: ProviderTask = {
  taskId: 'task-1',
  purpose: 'transcribe_region',
  sourceSha256: 'a'.repeat(64),
  pageIndices: [0],
  promptVersion: 'prompt-1',
  schemaVersion: 'schema-1',
  messages: [
    { role: 'system', content: 'Transcribe exactly.' },
    { role: 'user', content: 'Page evidence' },
  ],
  responseSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  },
};
export const config = {
  version: 1,
  maxContextTokens: 131072,
  maxOutputTokens: 32768,
  maxRequestBytes: 1000000,
  maxResponseBytes: 1000000,
  maxImages: 1,
  timeoutMs: 1000,
  dataCollection: 'deny',
  zeroDataRetention: false,
  operationLimitNano: '100000000',
  authorizedSourceSha256: ['a'.repeat(64)],
  promptHashes: {
    'prompt-1': checksumBuffer(Buffer.from('Transcribe exactly.')),
  },
  schemaHashes: { 'schema-1': jsonHash(task.responseSchema) },
};
export const tariff = {
  version: 1,
  promptPerMillionUsd: '0.104',
  completionPerMillionUsd: '0.416',
  requestUsd: '0',
  imageUsd: '0',
  evidenceSha256: 'b'.repeat(64),
  sourceUrl:
    'https://openrouter.ai/api/v1/models/qwen/qwen3-vl-32b-instruct/endpoints',
};
export const route: PdfProviderRoute = {
  id: 'route',
  accountKey: 'test',
  modelId: 'qwen/qwen3-vl-32b-instruct',
  providerSlug: 'alibaba',
  mode: 'stub',
  configuration: config,
  configurationSha256: jsonHash(config),
  tariff,
  tariffSha256: jsonHash(tariff),
  verifiedAt: new Date(),
  validUntil: new Date(Date.now() + 3600000),
  state: 'ACTIVE',
  createdAt: new Date(),
};
export const response = (cost: unknown = '0.001', extra = {}) =>
  Buffer.from(
    JSON.stringify({
      id: 'generation-test',
      model: route.modelId,
      usage: { cost, prompt_tokens: 100, completion_tokens: 10 },
      choices: [
        { finish_reason: 'stop', message: { content: '{"text":"read"}' } },
      ],
      ...extra,
    }),
  );
