import type { PdfProviderRoute } from '@prisma/client';
import { providerTaskSchema } from './task-schema';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jsonBytes, jsonHash } from './hash';
import { routePolicy } from './route-policy';
import { PdfProviderError } from './errors';
import type { ProviderTask } from './types';
import { requirePilotTask } from './pilot-task';
import { providerResponseSchema } from './response-schema';
export function prepareProviderRequest(
  route: PdfProviderRoute,
  task: ProviderTask,
) {
  const policy = routePolicy(route.configuration, route.tariff),
    { config, tariff } = policy;
  const parsed = providerTaskSchema.safeParse(task);
  if (!parsed.success)
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  const value = parsed.data,
    system = value.messages.filter((m) => m.role === 'system');
  const imageCount = value.messages.reduce(
    (n, m) =>
      n +
      (typeof m.content === 'string'
        ? 0
        : m.content.filter((p) => p.type === 'image_url').length),
    0,
  );
  if (
    system.length !== 1 ||
    typeof system[0].content !== 'string' ||
    imageCount > config.maxImages ||
    !Object.hasOwn(config.promptHashes, value.promptVersion) ||
    !Object.hasOwn(config.schemaHashes, value.schemaVersion) ||
    config.promptHashes[value.promptVersion] !==
      checksumBuffer(Buffer.from(system[0].content)) ||
    config.schemaHashes[value.schemaVersion] !== jsonHash(value.responseSchema)
  )
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  const effort = config.reasoningEffortByPrompt?.[value.promptVersion];
  const request = jsonBytes({
    model: route.modelId,
    messages: value.messages,
    max_tokens: config.maxOutputTokens,
    ...(effort ? { reasoning: { effort } } : {}),
    stream: false,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'ava_pdf_result',
        strict: true,
        schema: providerResponseSchema(route.modelId, value),
      },
    },
    plugins: [],
    transforms: [],
    provider: {
      only: [route.providerSlug],
      order: [route.providerSlug],
      allow_fallbacks: false,
      require_parameters: true,
      data_collection: config.dataCollection,
      zdr: config.zeroDataRetention,
      max_price: {
        prompt: Number(tariff.promptPerMillionUsd),
        completion: Number(tariff.completionPerMillionUsd),
        request: Number(tariff.requestUsd),
        image: Number(tariff.imageUsd),
      },
    },
  });
  if (request.length > config.maxRequestBytes)
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_LIMIT');
  const requestSha256 = checksumBuffer(request),
    taskSha256 = jsonHash(value);
  requirePilotTask(config, value, requestSha256, taskSha256);
  return {
    ...policy,
    request,
    requestSha256,
    taskSha256,
  };
}
