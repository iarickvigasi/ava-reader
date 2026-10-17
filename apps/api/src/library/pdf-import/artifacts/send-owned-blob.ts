import type { Response } from 'express';
import type { StoredBlob } from '@prisma/client';

export function sendOwnedBlob(
  response: Response,
  blob: Pick<StoredBlob, 'mimeType' | 'originalFilename' | 'bytes'>,
  download = true,
) {
  response.setHeader('Content-Type', blob.mimeType);
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const fallback =
    blob.mimeType === 'application/epub+zip' ? 'book.epub' : 'source.pdf';
  if (download)
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(blob.originalFilename)}`,
    );
  response.send(Buffer.from(blob.bytes));
}
