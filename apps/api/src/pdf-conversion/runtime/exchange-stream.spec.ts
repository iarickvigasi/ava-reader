import { exchangeStream } from './exchange-stream';
import { ExchangeFailure } from './exchange-failure';
import { exchangeInput, envelope, frame } from './exchange-test-fixture';

it('decodes every header/body fragmentation and retains marker-plus-artifact suffix exactly', async () => {
  const input = exchangeInput(),
    chunks: Buffer[] = [],
    sent: Buffer[] = [];
  input.onStdout = (chunk) => {
    chunks.push(chunk);
    return Promise.resolve();
  };
  const stream = exchangeStream(
    input,
    new AbortController().signal,
    (reply) => {
      sent.push(reply);
      return Promise.resolve();
    },
    () => {},
  );
  for (const value of [envelope(), envelope(2, 'refinement_batch')]) {
    for (const byte of frame(value)) await stream.write(Buffer.from([byte]));
  }
  const artifact = Buffer.from('{"artifact":"✓"}\n');
  const marker = frame(envelope(3, 'artifacts'));
  await stream.write(marker.subarray(0, 9));
  await stream.write(
    Buffer.concat([marker.subarray(9), artifact.subarray(0, 4)]),
  );
  await stream.write(artifact.subarray(4));
  expect(Buffer.concat(chunks)).toEqual(artifact);
  expect(sent).toHaveLength(2);
  expect(stream.finish()).toBeUndefined();
});

it.each([
  { source_sha256: 'b'.repeat(64) },
  { profile_id: 'ava-pdf-prose-en-uk-v3' },
])(
  'refuses wrong first-frame job binding before any callback',
  async (changed) => {
    const input = exchangeInput();
    input.onExchange = jest.fn(input.onExchange);
    const stream = exchangeStream(
      input,
      new AbortController().signal,
      () => Promise.resolve(),
      () => {},
    );
    await expect(
      stream.write(frame({ ...envelope(), ...changed })),
    ).rejects.toThrow('SOURCE_MISMATCH');
    expect(input.onExchange).not.toHaveBeenCalled();
  },
);

it('rejects coalesced unsolicited controls before invoking the host callback', async () => {
  const input = exchangeInput();
  input.onExchange = jest.fn(input.onExchange);
  const stream = exchangeStream(
    input,
    new AbortController().signal,
    () => Promise.resolve(),
    () => {},
  );
  await expect(
    stream.write(Buffer.concat([frame(envelope()), frame(envelope(2))])),
  ).rejects.toThrow('INVALID_RESULT');
  expect(input.onExchange).not.toHaveBeenCalled();
});

it('rejects another control while callback is pending and never sends a late aborted reply', async () => {
  const input = exchangeInput(),
    controller = new AbortController(),
    send = jest.fn(() => Promise.resolve());
  let resolve!: (value: Buffer) => void;
  const response = input.onExchange!;
  input.onExchange = () =>
    new Promise((done) => {
      resolve = done;
    });
  const stream = exchangeStream(input, controller.signal, send, () => {});
  const pending = stream.write(frame(envelope()));
  await expect(stream.write(frame(envelope(2)))).rejects.toThrow(
    'INVALID_RESULT',
  );
  controller.abort();
  resolve(
    await response(Buffer.from(JSON.stringify(envelope())), controller.signal),
  );
  await pending;
  expect(send).not.toHaveBeenCalled();
});

it('retains exact host exception only in the scoped exchange wrapper', async () => {
  const original = new Error('PDF_PROVIDER_OUTCOME_UNCERTAIN'),
    input = exchangeInput();
  input.onExchange = () => Promise.reject(original);
  const stream = exchangeStream(
    input,
    new AbortController().signal,
    () => Promise.resolve(),
    () => {},
  );
  await expect(stream.write(frame(envelope()))).rejects.toEqual(
    new ExchangeFailure(original),
  );
});

it('does not promote a primitive callback rejection to a typed domain exception', async () => {
  const input = exchangeInput();
  // Deliberately malformed callback rejection exercises the untyped-failure boundary.
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
  input.onExchange = () => Promise.reject('untyped');
  const stream = exchangeStream(
    input,
    new AbortController().signal,
    () => Promise.resolve(),
    () => {},
  );
  await expect(stream.write(frame(envelope()))).rejects.toThrow('WORKER_CRASH');
});

it('refuses zero/oversized lengths and EOF without a complete artifacts transition', async () => {
  for (const prefix of [Buffer.alloc(4), Buffer.from([127, 255, 255, 255])]) {
    const stream = exchangeStream(
      exchangeInput(),
      new AbortController().signal,
      () => Promise.resolve(),
      () => {},
    );
    await expect(stream.write(prefix)).rejects.toThrow('RESOURCE_LIMIT');
  }
  for (const partial of [
    Buffer.alloc(0),
    Buffer.from([0]),
    frame(envelope()).subarray(0, 13),
  ]) {
    const stream = exchangeStream(
      exchangeInput(),
      new AbortController().signal,
      () => Promise.resolve(),
      () => {},
    );
    await stream.write(partial);
    expect(() => stream.finish()).toThrow('INVALID_RESULT');
  }
});
