import { createHash, createHmac } from 'node:crypto';
export function operatorHeaders(url: URL, body?: BodyInit) {
  const secret = process.env.READING_ASSET_SYNC_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      'Server imports require READING_ASSET_SYNC_SECRET (at least 32 characters)',
    );
  const manifest = body instanceof FormData ? body.get('manifest') : body;
  if (manifest !== undefined && typeof manifest !== 'string')
    throw new Error('Expected an import manifest or publication JSON');
  const canonical =
    manifest === undefined ? '' : JSON.stringify(JSON.parse(manifest));
  const contentHash = createHash('sha256').update(canonical).digest('hex');
  const timestamp = String(Date.now());
  const payload = {
    scope: 'reading-import-operator',
    method: body === undefined ? 'GET' : 'POST',
    path: url.pathname + url.search,
    contentHash,
  };
  return {
    'x-reading-timestamp': timestamp,
    'x-reading-import-digest': contentHash,
    'x-reading-signature': createHmac('sha256', secret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest('hex'),
  };
}
