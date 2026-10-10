import { runSandbox } from './run-sandbox';
import { privateInputs } from './private-inputs';
import { startContainer } from './start-container';
import { dockerCommand } from './docker-command';
import { ExchangeFailure } from './exchange-failure';
import { exchangeInput } from './exchange-test-fixture';
import { testConfig } from './config-fixture';
jest.mock('./private-inputs');
jest.mock('./start-container');
jest.mock('./docker-command');
beforeEach(() => jest.resetAllMocks());

it.each([
  'PDF_PROVIDER_OUTCOME_UNCERTAIN',
  'PDF_PROVIDER_BUDGET_EXHAUSTED',
  'SOURCE_REFUSAL',
])(
  'surfaces original %s only after owned container removal and private input cleanup',
  async (code) => {
    const order: string[] = [],
      failure = new Error(code);
    jest.mocked(privateInputs).mockResolvedValue({
      directory: '/test/private-input',
      cleanup: () => {
        order.push('inputs');
        return Promise.resolve();
      },
    });
    jest.mocked(startContainer).mockImplementation(() => {
      order.push('start');
      return Promise.reject(new ExchangeFailure(failure));
    });
    jest.mocked(dockerCommand).mockImplementation((_config, args) => {
      expect(args.slice(0, 2)).toEqual(['rm', '--force']);
      order.push('container');
      return Promise.resolve({
        exitCode: 0,
        stdout: Buffer.alloc(0),
        stderr: '',
      });
    });
    await expect(runSandbox(exchangeInput(), testConfig)).rejects.toBe(failure);
    expect(order).toEqual(['start', 'container', 'inputs']);
  },
);

it.each(['container', 'inputs'])(
  'fails closed on %s cleanup failure while retaining original cause',
  async (which) => {
    const failure = new Error('PDF_PROVIDER_OUTCOME_UNCERTAIN');
    jest.mocked(privateInputs).mockResolvedValue({
      directory: '/test/private-input',
      cleanup: () =>
        which === 'inputs'
          ? Promise.reject(new Error('failed'))
          : Promise.resolve(),
    });
    jest.mocked(startContainer).mockRejectedValue(new ExchangeFailure(failure));
    jest.mocked(dockerCommand).mockResolvedValue({
      exitCode: which === 'container' ? 1 : 0,
      stdout: Buffer.alloc(0),
      stderr: 'not removed',
    });
    await expect(runSandbox(exchangeInput(), testConfig)).rejects.toMatchObject(
      { code: 'WORKER_CRASH', cleanupFailed: true, cause: failure },
    );
  },
);

it('does not preserve unwrapped exceptions outside the trusted exchange callback', async () => {
  jest.mocked(privateInputs).mockResolvedValue({
    directory: '/test/private-input',
    cleanup: () => Promise.resolve(),
  });
  jest
    .mocked(startContainer)
    .mockRejectedValue(new Error('untrusted worker text'));
  jest
    .mocked(dockerCommand)
    .mockResolvedValue({ exitCode: 0, stdout: Buffer.alloc(0), stderr: '' });
  await expect(runSandbox(exchangeInput(), testConfig)).rejects.toMatchObject({
    code: 'WORKER_CRASH',
    cleanupFailed: false,
  });
});

it('refuses invalid exchange entry before creating private inputs or processes', async () => {
  await expect(
    runSandbox(
      { ...exchangeInput(), module: 'ava_pdf_epub.runtime' },
      testConfig,
    ),
  ).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(privateInputs).not.toHaveBeenCalled();
  expect(startContainer).not.toHaveBeenCalled();
});
