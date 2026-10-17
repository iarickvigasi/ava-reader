import { containerArguments } from './container-arguments';
import { exchangeInput } from './exchange-test-fixture';
import { testConfig } from './config-fixture';

it('adds only finite stdin authority while preserving all existing process/container fences', () => {
  const input = exchangeInput();
  const normal = containerArguments(
    testConfig,
    { ...input, onExchange: undefined },
    'owned',
    '/private/input',
  );
  const interactive = containerArguments(
    testConfig,
    input,
    'owned',
    '/private/input',
  );
  expect(interactive.filter((value) => !normal.includes(value))).toEqual([
    '--interactive',
    '--env=AVA_PDF_RUNTIME_EXCHANGE=attempt_stream',
  ]);
  expect(
    interactive.filter(
      (value) =>
        !value.startsWith('--env=AVA_PDF_RUNTIME_EXCHANGE') &&
        value !== '--interactive',
    ),
  ).toEqual(normal);
  expect(normal).not.toContain('--interactive');
  expect(normal.some((arg) => arg.includes('AVA_PDF_RUNTIME_EXCHANGE'))).toBe(
    false,
  );
});

it('cannot opt arbitrary modules or altered initial requests into interactive mode', () => {
  for (const input of [
    { ...exchangeInput(), module: 'ava_pdf_epub.runtime.inspect' as const },
    {
      ...exchangeInput(),
      auxiliaryBytes: Buffer.from('{"mode":"prepare","page_number":1}'),
    },
  ])
    expect(() =>
      containerArguments(testConfig, input, 'owned', '/private/input'),
    ).toThrow('DISPATCH_NOT_AUTHORIZED');
});
