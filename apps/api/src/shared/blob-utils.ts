import { createHash } from 'crypto';

export function checksumBuffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function bufferToDataUrl(
  value: Buffer | Uint8Array,
  mimeType: string,
): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export function toPrismaBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(buffer);
}

export function titleFromFilename(filename: string) {
  const baseName = filename.replace(/\.[^.]+$/, '');
  const normalized = baseName
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length > 0 ? normalized : 'Untitled Upload';
}
