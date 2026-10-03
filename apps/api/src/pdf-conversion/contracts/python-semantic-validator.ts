import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { ContractError } from './contract-error';
import { MAX_CONTRACT_BYTES } from './parse-json';
import type { SemanticValidator } from './types';

// Local isolated-worker bridge. Paths are deployment configuration, never request input.
// Production job transport/leases are PDF-06; this does not run PDF parsing in Nest.
export function pythonSemanticValidator(executable: string): SemanticValidator {
  if (!isAbsolute(executable)) throw new ContractError('VALIDATOR_UNAVAILABLE');
  return (schema_version, _payload, wireJson) =>
    new Promise((resolve, reject) => {
      const input = `{"schema_version":${JSON.stringify(schema_version)},"payload":${wireJson}}`;
      if (Buffer.byteLength(input) > MAX_CONTRACT_BYTES) {
        reject(new ContractError('INVALID_CONTRACT'));
        return;
      }
      const child = spawn(
        executable,
        ['-I', '-m', 'ava_pdf_epub.contracts', 'validate'],
        {
          shell: false,
          stdio: ['pipe', 'pipe', 'ignore'],
          env: { LANG: 'C.UTF-8' },
        },
      );
      let output = '';
      let outputBytes = 0;
      let settled = false;
      const finish = (valid?: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (valid === undefined) {
          child.kill('SIGKILL');
          reject(new ContractError('VALIDATOR_UNAVAILABLE'));
        } else resolve(valid);
      };
      const timer = setTimeout(() => finish(), 15000);
      child.on('error', () => finish());
      child.stdin.on('error', () => finish());
      child.stdout.on('data', (data: Buffer) => {
        outputBytes += data.length;
        if (outputBytes > 1024) {
          finish();
          return;
        }
        output += data.toString('utf8');
      });
      child.on('close', (code) => {
        if (settled) return;
        try {
          const response = JSON.parse(output) as { valid?: unknown };
          if (code === 0 && response.valid === true) finish(true);
          else if (code === 1 && response.valid === false) finish(false);
          else finish();
        } catch {
          finish();
        }
      });
      child.stdin.end(input);
    });
}
