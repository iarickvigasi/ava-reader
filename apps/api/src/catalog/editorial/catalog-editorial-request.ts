import { catalogSignedRequest } from '../catalog-signed-request';
import { BadGatewayException, HttpException } from '@nestjs/common';

export async function catalogEditorialRequest(
  payload: object,
  endpoint: 'editorial' | 'edition-work' = 'editorial',
) {
  const response = await catalogSignedRequest(`internal/${endpoint}`, payload);
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if ([400, 404, 409].includes(response.status))
      throw new HttpException(
        error?.message ?? 'Catalog operation failed',
        response.status,
      );
    throw new BadGatewayException('Catalog operation failed');
  }
  return (await response.json()) as unknown;
}
