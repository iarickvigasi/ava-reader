import type { Candidate, MainStatus } from './types';
import { mainRequest } from './main-request';

export async function mainApi(
  candidate: Candidate,
  bytes?: Buffer,
): Promise<MainStatus> {
  const body = bytes ? new FormData() : undefined;
  if (body) {
    body.set('manifest', JSON.stringify(candidate));
    body.set(
      'sourceFile',
      new Blob([Uint8Array.from(bytes!)], { type: 'application/epub+zip' }),
      'source.epub',
    );
  }
  const query = new URLSearchParams({
    editionId: candidate.editionId,
    checksum: candidate.checksum!,
  });
  const status = await mainRequest<MainStatus>(
    `reading-imports${body ? '' : `?${query}`}`,
    body,
  );
  if (
    status.editionId !== candidate.editionId ||
    status.checksum !== candidate.checksum ||
    typeof status.id !== 'string' ||
    !status.id ||
    !['READY', 'PROCESSED', 'PENDING', 'WITHDRAWN', 'FAILED'].includes(
      status.status,
    )
  )
    throw new Error('Invalid main import receipt');
  return status;
}
