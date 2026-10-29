import { createHmac } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';

/** Server-only Catalog transport; callers retain operation-specific payloads and errors. */
export async function catalogSignedRequest(
  endpoint:
    | 'reading-assets/blobs'
    | 'reading-assets/publication'
    | 'internal/editorial'
    | 'internal/edition-work',
  payload: object,
  options: { bytes?: Buffer; timeout?: number; readBlobId?: string } = {},
) {
  const secret = process.env.READING_ASSET_SYNC_SECRET;
  const base = process.env.CATALOG_API_BASE_URL;
  if (!base || !secret || secret.length < 32)
    throw new ServiceUnavailableException(
      'Catalog connection is not configured',
    );
  const url = new URL(`${base.replace(/\/$/, '')}/api/${endpoint}`);
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['catalog', 'localhost', '127.0.0.1'].includes(url.hostname)
    )
  )
    throw new ServiceUnavailableException('Catalog connection requires HTTPS');
  const timestamp = String(Date.now());
  const json = JSON.stringify(payload);
  const sign = (value: string) =>
    createHmac('sha256', secret).update(`${timestamp}.${value}`).digest('hex');
  const headers: Record<string, string> = {
    'x-reading-timestamp': timestamp,
    'x-reading-signature': sign(json),
  };
  let body: BodyInit | undefined = json;
  if (endpoint === 'reading-assets/blobs') {
    headers['x-reading-auth'] = sign(
      JSON.stringify({ operation: 'public-storage' }),
    );
    if (options.bytes) {
      const form = new FormData();
      form.set('metadata', json);
      form.set(
        'file',
        new Blob([Uint8Array.from(options.bytes)], {
          type: 'application/octet-stream',
        }),
        'blob',
      );
      body = form;
    } else {
      url.pathname += `/${encodeURIComponent(options.readBlobId!)}`;
      body = undefined;
    }
  } else headers['content-type'] = 'application/json';
  return fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    body,
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(options.timeout ?? 30_000),
  });
}
