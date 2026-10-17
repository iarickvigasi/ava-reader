import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { ContractError } from '../contracts/contract-error';
import { MAX_CONTRACT_BYTES } from '../contracts/parse-json';
import type { ContentContext } from './prepare-reader-package';

export function pythonEpubReimport(executable: string) {
  if (!isAbsolute(executable)) throw new ContractError('VALIDATOR_UNAVAILABLE');
  return (epub: Buffer, context: ContentContext): Promise<Buffer> => {
    if (epub.length > 64 * 1024 * 1024)
      throw new ContractError('INVALID_CONTRACT');
    const input = JSON.stringify({
      epub_base64: epub.toString('base64'),
      canonical_sha256: context.canonicalSha256,
      final_content_id: context.finalContentId,
    });
    return new Promise((resolve, reject) => {
      const child = spawn(executable, ['-I', '-m', 'ava_pdf_epub.epub_v2'], {
        shell: false,
        stdio: ['pipe', 'pipe', 'ignore'],
        env: { LANG: 'C.UTF-8' },
      });
      const chunks: Buffer[] = [];
      let length = 0;
      let settled = false;
      const finish = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) resolve(Buffer.concat(chunks));
        else {
          child.kill('SIGKILL');
          reject(
            new ContractError(
              code === 1 ? 'INVALID_CONTRACT' : 'VALIDATOR_UNAVAILABLE',
            ),
          );
        }
      };
      const timer = setTimeout(() => finish(null), 15000);
      child.on('error', () => finish(null));
      child.stdin.on('error', () => finish(null));
      child.stdout.on('data', (data: Buffer) => {
        length += data.length;
        if (length > MAX_CONTRACT_BYTES) finish(null);
        else chunks.push(data);
      });
      child.on('close', finish);
      child.stdin.end(input);
    });
  };
}
