import { setTimeout as delay } from 'node:timers/promises';
import { allowedProviderHost } from './providers/allowed-host';
import type { EpubProvider } from './providers/provider-reference';

export async function fetchProvider(
  url: string,
  maxBytes: number,
  provider: EpubProvider,
): Promise<Buffer> {
  const agent = process.env.READING_IMPORT_USER_AGENT;
  if (!agent)
    throw new Error(
      'READING_IMPORT_USER_AGENT must identify AVA and a contact',
    );
  let target = new URL(url);
  for (let attempt = 0, redirects = 0; attempt < 3;) {
    if (!allowedProviderHost(target, provider))
      throw new Error('Unapproved provider host or protocol');
    await delay(1000);
    const response = await fetch(target, {
      redirect: 'manual',
      headers: { 'User-Agent': agent },
      signal: AbortSignal.timeout(120_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      if (++redirects > 5) throw new Error('Too many provider redirects');
      const location = response.headers.get('location');
      if (!location) throw new Error('Missing provider redirect');
      target = new URL(location, target);
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel();
      const retry = response.headers.get('retry-after');
      const wait = retry
        ? /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : Date.parse(retry) - Date.now()
        : 1000 * 2 ** attempt;
      if (wait > 60_000)
        throw new Error(
          `Provider requested a later retry (${retry}); rerun later`,
        );
      if (++attempt >= 3)
        throw new Error(`Provider HTTP ${response.status}; retries exhausted`);
      await delay(Math.max(1000, Number.isFinite(wait) ? wait : 1000));
      continue;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(`Provider HTTP ${response.status}`);
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      if (Number(response.headers.get('content-length')) > maxBytes)
        throw new Error('Provider response too large');
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return Buffer.concat(chunks);
        size += value.byteLength;
        if (size > maxBytes) throw new Error('Provider response too large');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
  }
  throw new Error('Provider request failed');
}
