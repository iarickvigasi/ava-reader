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

describe('source image stream compatibility', () => {
  const sourceSha =
    'f46c3075f2926db6e3146308182cf61c3aaefc9f8711b198d6c2a37040fd46f9';
  const image = (path: string, byte_length = 7106) => ({
    path,
    sha256: sourceSha,
    byte_length,
  });

  it.each(['png', 'jpg', 'jpeg'])(
    'accepts the qualified source %s path emitted by reconstruction',
    (extension) => {
      expect(() =>
        checkStreamProfile([
          ...manifest('reconstruction', 1024),
          image(`images/${sourceSha}.${extension}`),
        ]),
      ).not.toThrow();
    },
  );

  it.each([
    'images/logo.jpg',
    `images/${'g'.repeat(64)}.jpg`,
    `images/${sourceSha}.jpg.extra`,
    `images/${sourceSha}.svg`,
    `images/${sourceSha.toUpperCase()}.jpg`,
    `images/../${sourceSha}.jpg`,
  ])('rejects unsupported or malformed source image path %s', (path) => {
    expect(() =>
      checkStreamProfile([...manifest('reconstruction', 1024), image(path)]),
    ).toThrow('INVALID_RESULT');
  });

  it('keeps the EPUB-import resource namespace separate', () => {
    expect(() =>
      checkStreamProfile(
        [...manifest('epub-import', 1024), image(`images/${sourceSha}.jpg`)],
        'epub-import',
      ),
    ).toThrow('INVALID_RESULT');
  });

  it('keeps aggregate source-image bytes bounded', () => {
    expect(() =>
      checkStreamProfile([
        ...manifest('reconstruction', 1024),
        image(`images/${sourceSha}.jpg`, 201 * mib),
      ]),
    ).toThrow('RESOURCE_LIMIT');
  });
});
