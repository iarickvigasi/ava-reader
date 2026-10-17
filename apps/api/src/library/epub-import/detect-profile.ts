import JSZip from 'jszip';
import { boundEpubDirectory } from './zip-directory';
import { BadRequestException } from '@nestjs/common';
// Directory recognition only: never inflate a claimed sidecar or execute its URLs here.
export async function hasCanonicalEpubProfile(bytes: Buffer) {
  if (bytes.length > 50 * 1024 ** 2)
    throw new BadRequestException('The EPUB exceeds the import limit.');
  try {
    boundEpubDirectory(bytes);
    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.values(zip.files);
    if (entries.length > 24000) throw new Error('Entry bound');
    return entries.some((file) =>
      ['META-INF/ava-profile', 'EPUB/ava-canonical.json'].includes(file.name),
    );
  } catch {
    throw new BadRequestException('The EPUB archive could not be read.');
  }
}
