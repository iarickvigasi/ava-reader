import { exchangeEntry } from './exchange-entry';
import { exchangeInput, encode, envelope } from './exchange-test-fixture';

it('admits only the fixed attempt mode bound to the job source/profile', () => {
  expect(exchangeEntry(exchangeInput())).toBe(true);
  for (const input of [
    { ...exchangeInput(), module: 'ava_pdf_epub.runtime' as const },
    { ...exchangeInput(), onStdout: undefined },
    { ...exchangeInput(), jobBytes: undefined },
    {
      ...exchangeInput(),
      jobBytes: encode({
        source: { sha256: 'b'.repeat(64) },
        profile_id: envelope().profile_id,
      }),
    },
    {
      ...exchangeInput(),
      auxiliaryBytes: encode({ mode: 'reconstruct_stream', input: {} }),
    },
    {
      ...exchangeInput(),
      auxiliaryBytes: encode({
        mode: 'attempt_stream',
        input: {},
        path: '/tmp',
      }),
    },
  ])
    expect(() => exchangeEntry(input)).toThrow('DISPATCH_NOT_AUTHORIZED');
});

it('leaves ordinary commands without exchange authority unchanged', () => {
  expect(
    exchangeEntry({
      ...exchangeInput(),
      onExchange: undefined,
      auxiliaryBytes: Buffer.from('ordinary'),
    }),
  ).toBe(false);
});

it.each(['responses', 'refinements', 'profile_id', 'source_sha256', 'extra'])(
  'refuses changed initial %s authority',
  (key) => {
    const input = exchangeInput();
    const request = JSON.parse(input.auxiliaryBytes!.toString()) as {
      input: Record<string, unknown>;
    };
    request.input[key] =
      key === 'responses' || key === 'refinements' ? [{}] : 'different';
    expect(() =>
      exchangeEntry({ ...input, auxiliaryBytes: encode(request) }),
    ).toThrow('DISPATCH_NOT_AUTHORIZED');
  },
);
