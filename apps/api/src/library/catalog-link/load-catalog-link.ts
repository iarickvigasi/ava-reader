import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
export async function loadCatalogLink(workId: string) {
  const base = process.env.CATALOG_API_BASE_URL;
  if (!base) throw new ServiceUnavailableException('Catalog is not configured');
  const url = new URL(
    `${base.replace(/\/$/, '')}/api/works/${workId}/link-target`,
  );
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['catalog', 'localhost', '127.0.0.1'].includes(url.hostname)
    )
  )
    throw new ServiceUnavailableException('Catalog requires HTTPS');
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new BadGatewayException('Catalog unavailable; link will retry');
  }
  if (response.status === 404 || response.status === 400)
    throw new BadRequestException(
      'Work or edition no longer matches; choose again',
    );
  if (!response.ok)
    throw new BadGatewayException('Catalog unavailable; link will retry');
  return (await response.json()) as {
    workId: string;
    title: string;
    revision: number;
    authors: string[];
  };
}
