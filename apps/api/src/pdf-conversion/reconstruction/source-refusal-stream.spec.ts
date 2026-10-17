import { sourceRefusalStream } from './source-refusal-stream';
import { recognitionRefusal } from './recognition-refusal';
import { task, response } from './test-fixture';
const error = () =>
  recognitionRefusal(task, { ...response, unresolved: ['private prose'] });
const packet = () => Buffer.from(JSON.stringify(error().diagnostic()) + '\n');

it('handles fragmented refusal without staging readable artifacts or throwing in the pipe callback', async () => {
  const sink = jest.fn();
  const stream = sourceRefusalStream(task.source_sha256, sink);
  const bytes = packet();
  await stream.write(bytes.subarray(0, 20));
  await stream.write(bytes.subarray(20));
  expect(sink).not.toHaveBeenCalled();
  expect(() => stream.finish(1)).toThrow('UNSUPPORTED_PDF');
});
it('forwards normal candidate bytes unchanged with fragmented header', async () => {
  const chunks: Buffer[] = [];
  const stream = sourceRefusalStream(task.source_sha256, (b) => {
    chunks.push(b);
    return Promise.resolve();
  });
  const bytes = Buffer.from(
    '{"schema_version":"ava-reconstruct-stream-1"}\n{"candidate":"private source"}\n',
  );
  await stream.write(bytes.subarray(0, 10));
  await stream.write(bytes.subarray(10));
  await stream.write(Buffer.from('{"complete":true}\n'));
  stream.finish(0);
  expect(Buffer.concat(chunks)).toEqual(
    Buffer.concat([bytes, Buffer.from('{"complete":true}\n')]),
  );
});
it('refuses source mismatch, trailing artifacts and a success exit attached to refusal', async () => {
  await expect(
    sourceRefusalStream('b'.repeat(64), jest.fn()).write(packet()),
  ).rejects.toThrow('SOURCE_MISMATCH');
  await expect(
    sourceRefusalStream(task.source_sha256, jest.fn()).write(
      Buffer.concat([packet(), Buffer.from('{}\n')]),
    ),
  ).rejects.toThrow('INVALID_RESULT');
  const stream = sourceRefusalStream(task.source_sha256, jest.fn());
  await stream.write(packet());
  expect(() => stream.finish(0)).toThrow('INVALID_RESULT');
  await expect(stream.write(Buffer.from('{}\n'))).rejects.toThrow(
    'INVALID_RESULT',
  );
});
