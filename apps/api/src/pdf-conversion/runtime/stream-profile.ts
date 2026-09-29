import type { StreamArtifact } from './stream-schema';
import { PdfRuntimeError } from './runtime-error';
export function checkStreamProfile(
  artifacts: StreamArtifact[],
  profile: 'reconstruction' | 'epub-import' = 'reconstruction',
) {
  const required = new Map(
    profile === 'epub-import'
      ? [
          ['canonical.json', 20 * 1024 ** 2],
          ['reader.json', 32 * 1024 ** 2],
          ['import-report.json', 65536],
        ]
      : [
          ['canonical.json', 20 * 1024 ** 2],
          ['book.epub', 256 * 1024 ** 2],
          ['reconstruction-report.json', 4 * 1024 ** 2],
        ],
  );
  let resources = 0;
  if (new Set(artifacts.map((a) => a.path)).size !== artifacts.length)
    throw new PdfRuntimeError('INVALID_RESULT');
  for (const item of artifacts) {
    const limit = required.get(item.path);
    if (limit !== undefined) {
      if (item.byte_length > limit) throw new PdfRuntimeError('RESOURCE_LIMIT');
      required.delete(item.path);
    } else {
      const permitted =
        profile === 'epub-import'
          ? /^resources\/[a-f0-9]{64}$/.test(item.path)
          : /^(resources\/[A-Za-z0-9._/-]+\.(png|jpg|jpeg)|images\/[a-f0-9]{64}\.png)$/.test(
              item.path,
            );
      if (!permitted) throw new PdfRuntimeError('INVALID_RESULT');
      resources += item.byte_length;
    }
  }
  if (required.size) throw new PdfRuntimeError('INVALID_RESULT');
  if (resources > 200 * 1024 ** 2) throw new PdfRuntimeError('RESOURCE_LIMIT');
}
