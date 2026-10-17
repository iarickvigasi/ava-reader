import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installedReaderValidatorIdentity } from './validator-identity';

let root: string;
let executable: string;
let site: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ava-validator-identity-'));
  executable = join(root, 'bin', 'python');
  site = join(root, 'lib', 'python3.12', 'site-packages');
  await mkdir(join(root, 'bin'), { recursive: true });
  await writeFile(executable, 'trusted interpreter fixture');
  await writeFile(
    join(root, 'pyvenv.cfg'),
    'include-system-site-packages = false\n',
  );
  for (const name of [
    'ava_pdf_epub-0.1.0',
    'pydantic-2.13.5',
    'pydantic_core-2.46.5',
  ]) {
    await mkdir(join(site, `${name}.dist-info`), { recursive: true });
    await writeFile(
      join(site, `${name}.dist-info`, 'RECORD'),
      `${name} installed bytes`,
    );
  }
  await mkdir(join(site, 'ava_pdf_epub', 'contracts'), { recursive: true });
  await writeFile(
    join(site, 'ava_pdf_epub', 'contracts', 'reader.py'),
    'validator version one',
  );
});
afterEach(() => rm(root, { recursive: true, force: true }));
it('coalesces concurrent fingerprint reads and identifies the installed bytes', async () => {
  const first = installedReaderValidatorIdentity(executable);
  expect(installedReaderValidatorIdentity(executable)).toBe(first);
  expect(await first).toMatch(/^[a-f0-9]{64}$/);
  expect(await installedReaderValidatorIdentity(executable)).toBe(await first);
});
it('detects changed validator bytes at the same path and unchanged package version/RECORD', async () => {
  const before = await installedReaderValidatorIdentity(executable);
  await writeFile(
    join(site, 'ava_pdf_epub', 'contracts', 'reader.py'),
    'validator version two',
  );
  expect(await installedReaderValidatorIdentity(executable)).not.toBe(before);
});
it('detects changed installed dependency revision at the same path/version', async () => {
  const before = await installedReaderValidatorIdentity(executable);
  await writeFile(
    join(site, 'pydantic-2.13.5.dist-info', 'RECORD'),
    'changed dependency bytes',
  );
  expect(await installedReaderValidatorIdentity(executable)).not.toBe(before);
});
it('disables caching for editable installs', async () => {
  await writeFile(
    join(site, 'ava_pdf_epub-0.1.0.dist-info', 'direct_url.json'),
    JSON.stringify({ dir_info: { editable: true } }),
  );
  expect(await installedReaderValidatorIdentity(executable)).toBeNull();
});
it('disables caching when layout or installation metadata is unknown', async () => {
  expect(
    await installedReaderValidatorIdentity(join(root, 'python')),
  ).toBeNull();
  await rm(join(site, 'ava_pdf_epub-0.1.0.dist-info', 'RECORD'));
  expect(await installedReaderValidatorIdentity(executable)).toBeNull();
});

it('disables caching when system-site imports or editable dependencies make the runtime unknown', async () => {
  await writeFile(
    join(root, 'pyvenv.cfg'),
    'include-system-site-packages = true\n',
  );
  expect(await installedReaderValidatorIdentity(executable)).toBeNull();
  await writeFile(
    join(root, 'pyvenv.cfg'),
    'include-system-site-packages = false\n',
  );
  await writeFile(
    join(site, 'pydantic-2.13.5.dist-info', 'direct_url.json'),
    JSON.stringify({ dir_info: { editable: true } }),
  );
  expect(await installedReaderValidatorIdentity(executable)).toBeNull();
});
