import { operatorHeaders } from './operator-headers';
export async function mainRequest<T>(
  path: string,
  body?: BodyInit,
): Promise<T> {
  const base = process.env.READING_IMPORT_MAIN_API_URL;
  const token = process.env.READING_IMPORT_ADMIN_TOKEN;
  if (!base) throw new Error('Main API URL is required');
  if (!/^reading-imports(?:\?[^#]*|\/publish)?$/.test(path))
    throw new Error('Unsupported importer endpoint');
  const url = new URL(
    `${base.replace(/\/$/, '')}/${token ? 'admin' : 'internal'}/${path}`,
  );
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', 'api'].includes(url.hostname)
    )
  )
    throw new Error('Main API requires HTTPS (local development may use HTTP)');
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(120_000),
    headers: {
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : operatorHeaders(url, body)),
      ...(typeof body === 'string'
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
  });
  if (!response.ok)
    throw new Error(
      `Main API HTTP ${response.status}; check operator credentials, review, and synchronization`,
    );
  return (await response.json()) as T;
}
