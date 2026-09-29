import { ProviderTransportFailure } from './transport-failure';
const MAX_DIAGNOSTIC_BYTES = 64 * 1024;
export async function readHttpFailure(
  response: Response,
  limit: number,
  apiKey: string,
) {
  const maximum = Math.min(MAX_DIAGNOSTIC_BYTES, limit);
  const chunks: Buffer[] = [];
  let length = 0;
  let completeness = 'complete';
  const reader = response.body?.getReader();
  if (!reader) completeness = 'body_unavailable';
  try {
    if (reader)
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const take = Math.min(value.byteLength, maximum - length);
        if (take) chunks.push(Buffer.from(value.subarray(0, take)));
        length += take;
        if (take < value.byteLength) {
          completeness = 'body_limit';
          break;
        }
      }
  } catch {
    completeness = 'body_unavailable';
  } finally {
    try {
      await reader?.cancel();
    } catch {
      /* The bounded evidence remains incomplete. */
    }
  }
  const text = Buffer.concat(chunks, length).toString('utf8');
  let redacted = apiKey ? text.split(apiKey).join('[REDACTED]') : text;
  if (apiKey && completeness !== 'complete') {
    for (let n = Math.min(apiKey.length - 1, redacted.length); n >= 4; n--) {
      if (redacted.endsWith(apiKey.slice(0, n))) {
        redacted = redacted.slice(0, -n) + '[REDACTED]';
        break;
      }
    }
  }
  return new ProviderTransportFailure(
    Buffer.from(
      JSON.stringify({
        schema_version: 'ava-provider-http-failure-1',
        status: response.status,
        completeness,
        captured_bytes: length,
        body: redacted,
      }),
    ),
  );
}
