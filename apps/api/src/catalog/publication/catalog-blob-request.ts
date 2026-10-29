import { catalogSignedRequest } from '../catalog-signed-request';
export async function catalogBlobRequest(payload: object, bytes?: Buffer) {
  const response = await catalogSignedRequest('reading-assets/blobs', payload, {
    bytes,
    timeout: 60_000,
    readBlobId: (payload as { blobId?: string }).blobId,
  });
  if (!response.ok)
    throw new Error(`Catalog public storage failed (${response.status})`);
  return response;
}
