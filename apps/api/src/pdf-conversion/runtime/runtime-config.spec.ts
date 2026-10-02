import { containerArguments } from './container-arguments';
import {
  runtimeConfigFromEnvironment,
  validateRuntimeConfig,
} from './runtime-config';

import { testConfig } from './config-fixture';
describe('isolated PDF runtime configuration', () => {
  it.each([
    {},
    { ...testConfig, enabled: false },
    { ...testConfig, image: 'latest' },
    { ...testConfig, docker: 'docker' },
    { ...testConfig, dockerHost: 'tcp://host:2375' },
    { ...testConfig, memoryBytes: Infinity },
    { ...testConfig, cpus: 99 },
    {
      ...testConfig,
      mode: 'production',
      fault: 'deadline',
      faultAcknowledgement: 'AVA_PDF_RUNTIME_FAULTS_V1',
    },
    { ...testConfig, fault: 'deadline' },
    { ...testConfig, fault: 'arbitrary-command' },
  ])('refuses unpinned, unbounded or unauthorized configuration', (config) => {
    expect(() => validateRuntimeConfig(config as typeof testConfig)).toThrow(
      'DISPATCH_NOT_AUTHORIZED',
    );
  });
  it('requires opt-in and never infers credentials from inherited environment', () => {
    expect(() => runtimeConfigFromEnvironment({})).toThrow();
    const result = runtimeConfigFromEnvironment({
      AVA_PDF_RUNTIME_ENABLED: '1',
      AVA_PDF_DOCKER_BINARY: testConfig.docker,
      AVA_PDF_DOCKER_HOST: testConfig.dockerHost,
      AVA_PDF_WORKER_IMAGE: testConfig.image,
      OPENROUTER_API_KEY: 'not-forwarded',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.memoryBytes).toBe(2 * 1024 ** 3);
    const args = containerArguments(
      result,
      {
        source: Buffer.from('x'),
        module: 'ava_pdf_epub.runtime',
        deadlineMs: 1500,
        scratchBytes: 67108864,
      },
      'bounded-book',
      '/private/input',
    );
    expect(args).toContain('--memory=2147483648');
    expect(args).toContain('--memory-swap=2147483648');
    expect(JSON.stringify(result)).not.toContain('not-forwarded');
  });
  it('cannot override real production mode with a development object', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        validateRuntimeConfig({
          ...testConfig,
          fault: 'deadline',
          faultAcknowledgement: 'AVA_PDF_RUNTIME_FAULTS_V1',
        }),
      ).toThrow();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
  it('bounds the entire container and has an independent wall clock killer', () => {
    const args = containerArguments(
      testConfig,
      {
        source: Buffer.from('x'),
        module: 'ava_pdf_epub.runtime',
        deadlineMs: 1500,
        scratchBytes: 67108864,
      },
      'owned-name',
      '/private/input',
    );
    for (const value of [
      '--network=none',
      '--read-only',
      '--user=10001:10001',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--pids-limit=32',
      '--memory=536870912',
      '--memory-swap=536870912',
      '--cpus=1',
      '--rm',
      '--init',
      '--pull=never',
      '--entrypoint=/usr/bin/timeout',
    ])
      expect(args).toContain(value);
    expect(args).toContain(
      'type=bind,source=/private/input,target=/input,readonly',
    );
    expect(args.slice(-7)).toEqual([
      '--signal=KILL',
      '--kill-after=1',
      '2',
      '/worker/.venv/bin/python',
      '-I',
      '-m',
      'ava_pdf_epub.runtime.supervisor',
    ]);
  });
});
