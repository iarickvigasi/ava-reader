import { spawn } from 'node:child_process';
import { ContractError } from './contract-error';
import { MAX_CONTRACT_BYTES } from './parse-json';
import { readValidatorResponse } from './read-validator-response';
import { reportValidatorFailure } from './report-validator-failure';
import type {
  ValidatorFailureContext,
  ValidatorInvocation,
} from './validator-failure.types';
export function runPythonSemanticValidator(
  params: ValidatorInvocation,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const input = `{"schema_version":${JSON.stringify(params.schema)},"payload":${params.wireJson}}`;
    const inputBytes = Buffer.byteLength(input);
    let stdoutBytes = 0;
    let spawnObserved = false;
    const report = (failure: ValidatorFailureContext) =>
      reportValidatorFailure(params.observer, {
        ...failure,
        schema: params.schema,
        elapsedMs: performance.now() - started,
        inputBytes,
        stdoutBytes,
        spawnObserved,
        timerFired: failure.timerFired ?? false,
        closeObserved: failure.closeObserved ?? false,
        exitCode: failure.exitCode ?? null,
      });
    if (inputBytes > MAX_CONTRACT_BYTES) {
      report({ reason: 'INPUT_LIMIT' });
      reject(new ContractError('INVALID_CONTRACT'));
      return;
    }
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(
        params.executable,
        ['-I', '-m', 'ava_pdf_epub.contracts', 'validate'],
        {
          shell: false,
          stdio: ['pipe', 'pipe', 'ignore'],
          env: { LANG: 'C.UTF-8' },
        },
      );
    } catch (error) {
      report({ reason: 'SPAWN_ERROR', error });
      reject(error); // eslint-disable-line @typescript-eslint/prefer-promise-reject-errors
      return;
    }
    let output = '';
    let settled = false;
    const finish = (outcome: boolean | ValidatorFailureContext) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (typeof outcome === 'boolean') {
        resolve(outcome);
        return;
      }
      try {
        child.kill('SIGKILL');
      } catch {
        /* Cleanup cannot skip settlement. */
      }
      report(outcome);
      const fallback = new ContractError('VALIDATOR_UNAVAILABLE');
      const retained = Object.hasOwn(outcome, 'rejection');
      reject(retained ? outcome.rejection : fallback); // eslint-disable-line @typescript-eslint/prefer-promise-reject-errors
    };
    const expire = () => finish({ reason: 'DEADLINE', timerFired: true });
    const timer = setTimeout(expire, 15000);
    child.on('spawn', () => {
      spawnObserved = true;
    });
    child.on('error', (error) => finish({ reason: 'SPAWN_ERROR', error }));
    child.stdin!.on('error', (error) =>
      finish({ reason: 'STDIN_ERROR', error }),
    );
    child.stdout!.on('data', (data: Buffer) => {
      if (settled) return;
      stdoutBytes += data.length;
      if (stdoutBytes > 1024) {
        finish({ reason: 'OUTPUT_LIMIT' });
        return;
      }
      output += data.toString('utf8');
    });
    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      finish(readValidatorResponse(output, code, signal));
    });
    try {
      child.stdin!.end(input);
    } catch (error) {
      finish({ reason: 'STDIN_ERROR', error, rejection: error });
    }
  });
}
