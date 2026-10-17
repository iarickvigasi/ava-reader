import { lstat, open, readdir, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { dockerCommand } from './docker-command';
import { validateRuntimeConfig, type PdfRuntimeConfig } from './runtime-config';

const markerSchema = z
  .object({
    version: z.literal(1),
    containerName: z.string().regex(/^ava-pdf-[a-f0-9-]{36}$/),
    cleanupAfter: z.number().int().positive().safe(),
  })
  .strict();

export async function reapPrivateInputs(settings: PdfRuntimeConfig) {
  const config = validateRuntimeConfig(settings);
  let removed = 0;
  for (const entry of await readdir(tmpdir(), { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      !/^ava-pdf-runtime-[A-Za-z0-9]{6}$/.test(entry.name)
    )
      continue;
    const root = join(tmpdir(), entry.name);
    const info = await lstat(root).catch(() => null);
    if (
      !info?.isDirectory() ||
      info.uid !== process.getuid?.() ||
      (info.mode & 0o777) !== 0o700
    )
      continue;
    const file = await open(
      join(root, 'runtime.json'),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    ).catch(() => null);
    if (!file) continue;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 1024 || stat.uid !== info.uid) continue;
      const parsed: unknown = JSON.parse(await file.readFile('utf8'));
      const marker = markerSchema.safeParse(parsed);
      if (!marker.success || marker.data.cleanupAfter > Date.now()) continue;
      const result = await dockerCommand(
        config,
        ['rm', '--force', marker.data.containerName],
        10000,
        1024,
      );
      if (result.exitCode !== 0 && !result.stderr.includes('No such container'))
        continue;
      await rm(root, { recursive: true, force: true });
      removed += 1;
    } catch {
      /* Retain unknown or unremovable private state for operator investigation. */
    } finally {
      await file.close();
    }
  }
  return { removed };
}
