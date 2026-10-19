import { createHash } from 'node:crypto';

export function decodeArtifact(
  encoded: string,
  descriptor: { id: string; byte_length: number; sha256: string },
) {
  if (encoded.length !== 4 * Math.ceil(descriptor.byte_length / 3))
    throw new Error('Encoded size');
  const bytes = Buffer.from(encoded, 'base64');
  if (
    bytes.toString('base64') !== encoded ||
    bytes.length !== descriptor.byte_length ||
    createHash('sha256').update(bytes).digest('hex') !== descriptor.sha256
  )
    throw new Error('Bytes');
  return { id: descriptor.id, bytes };
}
