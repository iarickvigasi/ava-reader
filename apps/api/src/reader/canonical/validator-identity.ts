import { readdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { checksumBuffer } from '../../shared/blob-utils';

const pending = new Map<string, Promise<string | null>>();
// Installed-wheel layout only. Unknown/editable installs keep full semantic validation.
export function installedReaderValidatorIdentity(
  executable: string,
): Promise<string | null> {
  if (
    !isAbsolute(executable) ||
    dirname(executable).split('/').at(-1) !== 'bin'
  )
    return Promise.resolve(null);
  const existing = pending.get(executable);
  if (existing) return existing;
  if (pending.size >= 2) return Promise.resolve(null);
  const discovery = fingerprint(executable).catch(() => null);
  pending.set(executable, discovery);
  void discovery.finally(() => pending.delete(executable));
  return discovery;
}

async function fingerprint(executable: string) {
  const configuration = join(dirname(executable), '..', 'pyvenv.cfg');
  if (
    !/^include-system-site-packages\s*=\s*false\s*$/m.test(
      await readFile(configuration, 'utf8'),
    )
  )
    return null;
  const library = join(dirname(executable), '..', 'lib');
  const versions = (await readdir(library)).filter((name) =>
    /^python3\.\d+$/.test(name),
  );
  if (versions.length !== 1) return null;
  const site = join(library, versions[0], 'site-packages');
  const distributions = (await readdir(site))
    .filter((name) => name.endsWith('.dist-info'))
    .sort();
  for (const dependency of ['ava_pdf_epub', 'pydantic', 'pydantic_core'])
    if (
      distributions.filter((name) => name.startsWith(`${dependency}-`))
        .length !== 1
    )
      return null;
  for (const name of distributions.filter((value) =>
    /^(ava_pdf_epub|pydantic|pydantic_core)-/.test(value),
  )) {
    const metadata = join(site, name);
    if ((await readdir(metadata)).includes('direct_url.json')) {
      const source = JSON.parse(
        await readFile(join(metadata, 'direct_url.json'), 'utf8'),
      ) as { dir_info?: { editable?: boolean } };
      if (source.dir_info?.editable) return null;
    }
  }
  // Reuse the worker fingerprint policy: actual installed AVA .py/.json bytes.
  // RECORD bytes bind the installed dependency revisions, even with unchanged versions.
  const files = [
    executable,
    configuration,
    ...(await packageFiles(join(site, 'ava_pdf_epub'))),
    ...distributions.map((name) => join(site, name, 'RECORD')),
  ].sort();
  const digests: [string, string][] = [];
  // Bound simultaneous reads and release each byte buffer after hashing.
  for (let index = 0; index < files.length; index += 8)
    digests.push(
      ...(await Promise.all(
        files
          .slice(index, index + 8)
          .map(
            async (file): Promise<[string, string]> => [
              relative(site, file),
              checksumBuffer(await readFile(file)),
            ],
          ),
      )),
    );
  return checksumBuffer(Buffer.from(JSON.stringify([executable, digests])));
}
async function packageFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Unsupported validator layout');
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await packageFiles(path)));
    else if (/\.(py|json)$/.test(entry.name)) files.push(path);
  }
  return files.sort();
}
