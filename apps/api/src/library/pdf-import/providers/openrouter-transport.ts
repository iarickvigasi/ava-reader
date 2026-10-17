import type { ProviderTransport } from './types';
import { PdfProviderError } from './errors';
import { readHttpFailure } from './http-failure';
// Fixed destination; no caller-supplied URL, redirect or provider retry.
export const openRouterTransport: ProviderTransport = async (input) => {
  const deadline = AbortSignal.timeout(input.timeoutMs);
  const signal = input.signal
    ? AbortSignal.any([input.signal, deadline])
    : deadline;
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: input.request.toString('utf8'),
    },
  );
  if (!response.ok)
    throw await readHttpFailure(response, input.maxResponseBytes, input.apiKey);
  if (!response.body)
    throw new PdfProviderError('PDF_PROVIDER_TRANSPORT_UNCERTAIN');
  const reader = response.body.getReader(),
    chunks: Buffer[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > input.maxResponseBytes)
        throw new PdfProviderError('PDF_PROVIDER_RESPONSE_LIMIT');
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks, length);
};
