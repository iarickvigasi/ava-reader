import type { PdfRuntimeConfig } from './runtime-config';
import type { FaultExpectation } from './fault-acknowledgement';

export type SandboxInput = {
  source: Buffer;
  jobBytes?: Buffer;
  auxiliaryBytes?: Buffer;
  onStdout?: (chunk: Buffer) => Promise<void>;
  module:
    | 'ava_pdf_epub.runtime'
    | 'ava_pdf_epub.runtime.inspect'
    | 'ava_pdf_epub.runtime.validate_epub'
    | 'ava_pdf_epub.runtime.import_epub'
    | 'ava_pdf_epub.reconstruction_v2';
  deadlineMs: number;
  scratchBytes: number;
  signal?: AbortSignal;
  faultContext?: FaultExpectation;
  leaseRemainingMs?: () => number;
};

export function containerArguments(
  config: PdfRuntimeConfig,
  input: SandboxInput,
  name: string,
  directory: string,
) {
  const args = [
    'create',
    '--name',
    name,
    '--rm',
    '--init',
    '--pull=never',
    '--network=none',
    '--read-only',
    '--user=10001:10001',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pids-limit=32',
    '--log-driver=none',
    `--memory=${config.memoryBytes}`,
    `--memory-swap=${config.memoryBytes}`,
    `--cpus=${config.cpus}`,
    '--shm-size=1048576',
    '--ulimit=nofile=128:128',
    `--ulimit=fsize=${input.scratchBytes}:${input.scratchBytes}`,
    `--ulimit=cpu=${Math.ceil(input.deadlineMs / 1000)}:${Math.ceil(input.deadlineMs / 1000)}`,
    '--tmpfs',
    `/scratch:rw,noexec,nosuid,nodev,size=${input.scratchBytes},uid=10001,gid=10001,mode=700`,
    '--mount',
    `type=bind,source=${directory},target=/input,readonly`,
    '--workdir=/scratch',
    '--env=TMPDIR=/scratch/tmp',
    '--env=HOME=/scratch',
    '--env=LANG=C.UTF-8',
    `--env=AVA_PDF_RUNTIME_TARGET=${input.module}`,
    '--stop-timeout=1',
    '--label=ava.pdf.runtime=1',
    '--entrypoint=/usr/bin/timeout',
  ];
  if (config.fault && input.module === 'ava_pdf_epub.runtime')
    args.push(
      '--env=AVA_PDF_RUNTIME_MODE=development',
      `--env=AVA_PDF_RUNTIME_FAULT=${config.fault}`,
      '--env=AVA_PDF_FAULT_ACK=AVA_PDF_RUNTIME_FAULTS_V1',
    );
  return [
    ...args,
    config.image,
    '--signal=KILL',
    '--kill-after=1',
    `${Math.ceil(input.deadlineMs / 1000)}`,
    '/worker/.venv/bin/python',
    '-I',
    '-m',
    'ava_pdf_epub.runtime.supervisor',
  ];
}
