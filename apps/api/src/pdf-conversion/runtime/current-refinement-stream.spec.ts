import { exchangeStream } from './exchange-stream';
import { currentRefinementInput } from './current-refinement-input-fixture';
import { envelope, encode, frame } from './exchange-test-fixture';
import { MAX_CURRENT_REFINEMENT_FRAME } from './refinement-frame-budget';

it('accepts a real fragmented 25MiB batch only after current admitted Input10', async () => {
  const input = currentRefinementInput();
  const job = JSON.parse(input.jobBytes.toString()) as {
    source: { sha256: string };
    profile_id: string;
  };
  const control = {
    ...envelope(),
    schema_version: 'ava-reconstruction-exchange-2',
    source_sha256: job.source.sha256,
    profile_id: job.profile_id,
  };
  const send = jest
    .fn<Promise<void>, [Buffer, boolean]>()
    .mockResolvedValue(undefined);
  const stream = exchangeStream(
    input,
    new AbortController().signal,
    send,
    () => {},
  );
  await stream.write(
    frame({
      ...control,
      payload: { schema_version: 'ava-prepare-result-5', tasks: [] },
    }),
  );
  const bytes = frame({
    ...control,
    sequence: 2,
    kind: 'refinement_batch',
    payload: {
      schema_version: 'ava-book-refinement-batch-4',
      source_continuation_policy: 'ava-source-continuation-presentation-1',
      tasks: [],
      pixels: 'x'.repeat(25 * 1024 ** 2),
    },
  });
  await stream.write(bytes.subarray(0, 1));
  await stream.write(bytes.subarray(1, 7));
  expect(send).toHaveBeenCalledTimes(1);
  for (let offset = 7; offset < bytes.length; offset += 1024 ** 2)
    await stream.write(bytes.subarray(offset, offset + 1024 ** 2));
  expect(send).toHaveBeenCalledTimes(2);
  const reply = JSON.parse(send.mock.calls[1][0].subarray(4).toString()) as {
    kind: string;
    payload: unknown;
  };
  expect(reply).toMatchObject({ kind: 'refinement_batch', payload: [] });
  expect(stream.waiting).toBe(false);
});

it('refuses old and oversized current length prefixes before reading their body', async () => {
  for (const [current, length] of [
    [false, 25 * 1024 ** 2],
    [true, MAX_CURRENT_REFINEMENT_FRAME + 1],
  ] as const) {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(length);
    const send = jest.fn();
    const stream = exchangeStream(
      currentRefinementInput(current),
      new AbortController().signal,
      send,
      () => {},
    );
    await expect(stream.write(header)).rejects.toThrow('RESOURCE_LIMIT');
    expect(send).not.toHaveBeenCalled();
  }
});

it('does not admit a current packet paired with an older capture', () => {
  const current = currentRefinementInput(),
    old = currentRefinementInput(false);
  expect(() =>
    exchangeStream(
      { ...current, jobBytes: old.jobBytes },
      new AbortController().signal,
      async () => {},
      () => {},
    ),
  ).toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(encode(JSON.parse(old.auxiliaryBytes.toString()))).toEqual(
    old.auxiliaryBytes,
  );
});
