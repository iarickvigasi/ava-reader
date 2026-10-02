import { MAX_CONTRACT_BYTES } from '../contracts/parse-json';
import { checkStreamProfile } from './stream-profile';

const mib = 1024 ** 2;
function manifest(
  profile: 'reconstruction' | 'epub-import',
  canonicalBytes: number,
) {
  const names =
    profile === 'epub-import'
      ? ['canonical.json', 'reader.json', 'import-report.json']
      : ['canonical.json', 'book.epub', 'reconstruction-report.json'];
  return names.map((path) => ({
    path,
    sha256: 'a'.repeat(64),
    byte_length: path === 'canonical.json' ? canonicalBytes : 1024,
  }));
}
describe('full-book artifact capacity', () => {
  it.each(['reconstruction', 'epub-import'] as const)(
    'accepts the measured 29 MiB canonical book in %s',
    (profile) => {
      expect(() =>
        checkStreamProfile(manifest(profile, 29 * mib), profile),
      ).not.toThrow();
    },
  );
  it.each(['reconstruction', 'epub-import'] as const)(
    'rejects %s canonical overflow before body allocation',
    (profile) => {
      expect(() =>
        checkStreamProfile(manifest(profile, MAX_CONTRACT_BYTES + 1), profile),
      ).toThrow('RESOURCE_LIMIT');
    },
  );
  it('keeps the reader envelope bounded at the shared contract limit', () => {
    const entries = manifest('epub-import', 29 * mib);
    entries[1].byte_length = MAX_CONTRACT_BYTES;
    expect(() => checkStreamProfile(entries, 'epub-import')).not.toThrow();
    entries[1].byte_length++;
    expect(() => checkStreamProfile(entries, 'epub-import')).toThrow(
      'RESOURCE_LIMIT',
    );
  });
  it('does not raise resource or required-artifact protections', () => {
    expect(() =>
      checkStreamProfile(manifest('reconstruction', 29 * mib).slice(0, 2)),
    ).toThrow('INVALID_RESULT');
    const entries = manifest('epub-import', 29 * mib);
    entries.push({
      path: 'resources/' + 'b'.repeat(64),
      sha256: 'b'.repeat(64),
      byte_length: 201 * mib,
    });
    expect(() => checkStreamProfile(entries, 'epub-import')).toThrow(
      'RESOURCE_LIMIT',
    );
  });
});
