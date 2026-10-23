import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readLines } from './read-lines';
import { MAX_LINE_BYTES } from './types';

async function collect(path: string) {
  const rows = [];
  for await (const row of readLines(path)) rows.push(row);
  return rows;
}

describe('streamed dump input', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ava-dump-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  it('reads gzip and plain Unicode lines, CRLF, and a final line without newline', async () => {
    const input = 'Книга\r\nauthor\nlast';
    for (const name of ['dump.txt', 'dump.txt.gz']) {
      const path = join(directory, name);
      await writeFile(path, name.endsWith('.gz') ? gzipSync(input) : input);
      expect(await collect(path)).toEqual(['Книга', 'author', 'last']);
    }
  });
  it('quarantines an oversized line and continues at the next line boundary', async () => {
    const path = join(directory, 'large.txt');
    await writeFile(path, 'x'.repeat(MAX_LINE_BYTES + 1) + '\nvalid\n');
    expect(await collect(path)).toEqual([null, 'valid']);
  });
  it('propagates invalid gzip and missing-file errors', async () => {
    const path = join(directory, 'bad.gz');
    await writeFile(path, 'not gzip');
    await expect(collect(path)).rejects.toThrow();
    await expect(collect(join(directory, 'absent.txt'))).rejects.toThrow();
  });
});
