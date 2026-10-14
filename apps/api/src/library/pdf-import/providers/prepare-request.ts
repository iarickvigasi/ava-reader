import type { PdfProviderRoute } from '@prisma/client';
import { providerTaskSchema } from './task-schema';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jsonBytes, jsonHash } from './hash';
import { routePolicy } from './route-policy';
import { PdfProviderError } from './errors';
import type { ProviderTask } from './types';
import { tokenCost, usdToNano } from './money';
import { requirePilotTask } from './pilot-task';
import { providerRequestFormat } from './request-format';
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
  if (
    value.maxOutputTokens !== undefined &&
    value.maxOutputTokens > config.maxOutputTokens
  )
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_LIMIT');
  const maxOutputTokens = value.maxOutputTokens ?? config.maxOutputTokens;
  const maximumNano =
    policy.maximumNano -
    tokenCost(
      usdToNano(tariff.completionPerMillionUsd),
      config.maxOutputTokens,
    ) +
    tokenCost(usdToNano(tariff.completionPerMillionUsd), maxOutputTokens);
  const effort = config.reasoningEffortByPrompt?.[value.promptVersion];
  const format = providerRequestFormat(route.modelId, value);
  const request = jsonBytes({
    model: route.modelId,
    messages: format.messages,
    max_tokens: maxOutputTokens,
    ...(effort ? { reasoning: { effort } } : {}),
    stream: false,
    response_format: format.responseFormat,
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
    maximumNano,
    request,
    requestSha256,
    taskSha256,
  };
}
