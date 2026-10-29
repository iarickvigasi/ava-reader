import JSZip from 'jszip';
import { Readable } from 'node:stream';
import { BadRequestException } from '@nestjs/common';
import { MAX_IMPORT_BYTES } from './manifest';
import { checkZipDirectory } from './check-zip-directory';

const MAX_EXPANDED_BYTES = 200 * 1024 * 1024;
const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 10_000;

export async function validateEpubArchive(bytes: Buffer) {
  if (
    bytes.length < 4 ||
    bytes.length > MAX_IMPORT_BYTES ||
    bytes.readUInt32LE(0) !== 0x04034b50
  )
    throw new BadRequestException('Invalid or oversized EPUB');
  try {
    checkZipDirectory(bytes);
    const zip = await JSZip.loadAsync(bytes);
    const files = Object.values(zip.files);
    if (files.length > MAX_ENTRIES || zip.file('META-INF/encryption.xml'))
      throw new Error('Encrypted or oversized archive');
    let total = 0;
    for (const file of files) {
      const details = file as unknown as {
        unsafeOriginalName?: string;
        _data?: { uncompressedSize?: number };
      };
      const original = details.unsafeOriginalName ?? file.name;
      if (
        original.startsWith('/') ||
        original.split(/[\\/]/).includes('..') ||
        [...original].some((char) => char.charCodeAt(0) < 32) ||
        (details._data?.uncompressedSize ?? 0) > MAX_ENTRY_BYTES
      )
        throw new Error('Unsafe archive entry');
      if (file.dir) continue;
      let entrySize = 0;
      const stream = new Readable().wrap(file.nodeStream());
      try {
        for await (const chunk of stream) {
          entrySize += (chunk as Buffer).length;
          total += (chunk as Buffer).length;
          if (entrySize > MAX_ENTRY_BYTES || total > MAX_EXPANDED_BYTES)
            throw new Error('Expanded EPUB exceeds limit');
        }
      } finally {
        stream.destroy();
      }
    }
    if (
      (await zip.file('mimetype')?.async('text')) !== 'application/epub+zip' ||
      !zip.file('META-INF/container.xml')
    )
      throw new Error('Missing EPUB container or mimetype');
  } catch {
    throw new BadRequestException(
      'Corrupt, encrypted, unsafe, or oversized EPUB archive',
    );
  }
}
