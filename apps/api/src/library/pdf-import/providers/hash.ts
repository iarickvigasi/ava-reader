import { checksumBuffer } from '../../../shared/blob-utils';
export function jsonBytes(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value));
}
export function jsonHash(value: unknown): string {
  return checksumBuffer(jsonBytes(value));
}
