import { workerStderr } from './worker-stderr';
import {
  WORKER_OBSERVATION_BYTES,
  WORKER_OBSERVATION_PREFIX,
} from './worker-observation';
import { faultAcknowledgement } from './fault-acknowledgement';

const packet = WORKER_OBSERVATION_PREFIX + '{}\n';
it.each(['x'.repeat(8192), 'x'.repeat(8191) + '\n'])(
  'the real writer separator cannot exhaust a previously valid full stderr budget',
  (ordinary) => {
    const stderr = workerStderr(true);
    expect(stderr.append(Buffer.from(ordinary))).toBe(true);
    expect(stderr.append(Buffer.from('\n' + packet))).toBe(true);
    expect(stderr.finish()).toMatchObject({
      stderr: ordinary,
      observationStderr: '\n' + packet,
      observationMalformed: false,
      exhausted: false,
    });
  },
);
it('retains the ordinary8192 limit and one independently bounded observation across bytewise chunks', () => {
  const stderr = workerStderr(true),
    ordinary = 'x'.repeat(8191) + '\n';
  for (const byte of Buffer.from(ordinary + '\n' + packet))
    expect(stderr.append(Buffer.from([byte]))).toBe(true);
  expect(stderr.finish()).toMatchObject({
    stderr: ordinary,
    observationStderr: '\n' + packet,
    observationMalformed: false,
    exhausted: false,
  });
});
it('preserves legacy accounting when observations are disabled', () => {
  const stderr = workerStderr();
  expect(stderr.append(Buffer.from('x'.repeat(8192)))).toBe(true);
  expect(stderr.append(Buffer.from(packet))).toBe(false);
});
it('a partial prefix at EOF consumes ordinary budget and cannot hide an overflow', () => {
  const stderr = workerStderr(true);
  expect(
    stderr.append(
      Buffer.from(
        'x'.repeat(8191) + '\n' + WORKER_OBSERVATION_PREFIX.slice(0, -1),
      ),
    ),
  ).toBe(true);
  expect(stderr.finish()).toMatchObject({
    exhausted: true,
    observationStderr: undefined,
  });
});
it('missing newline and oversized candidates are unobserved without exempting unlimited bytes', () => {
  const incomplete = workerStderr(true);
  expect(incomplete.append(Buffer.from(packet.slice(0, -1)))).toBe(true);
  expect(incomplete.finish().observationMalformed).toBe(true);
  const long = workerStderr(true);
  expect(
    long.append(
      Buffer.from(
        WORKER_OBSERVATION_PREFIX + 'x'.repeat(WORKER_OBSERVATION_BYTES) + '\n',
      ),
    ),
  ).toBe(true);
  const result = long.finish();
  expect(result.observationMalformed).toBe(true);
  expect(Buffer.byteLength(result.observationStderr!)).toBe(
    WORKER_OBSERVATION_BYTES,
  );
  const exhausted = workerStderr(true);
  expect(
    exhausted.append(
      Buffer.from(WORKER_OBSERVATION_PREFIX + 'x'.repeat(14336)),
    ),
  ).toBe(false);
});
it('duplicate reserved packets consume ordinary budget and preserve a real fault acknowledgement', () => {
  const stderr = workerStderr(true),
    expected = {
      fault: 'resource',
      operation_id: 'pdf-example',
      attempt_fence: 2,
    };
  const acknowledgement =
    JSON.stringify({ ...expected, event: 'fault_ack', at_ms: 123 }) + '\n';
  expect(stderr.append(Buffer.from(packet + acknowledgement + packet))).toBe(
    true,
  );
  const result = stderr.finish();
  expect(result.observationMalformed).toBe(true);
  expect(result.stderr).toBe(acknowledgement + packet);
  expect(faultAcknowledgement(result.stderr, expected)).toMatchObject({
    event: 'fault_ack',
    at_ms: 123,
  });
});
it('an arbitrary long prefix lookalike receives no observation allowance', () => {
  const stderr = workerStderr(true);
  expect(
    stderr.append(Buffer.from('AVA_WORKER_OBSERVATION_V2 ' + 'x'.repeat(8192))),
  ).toBe(false);
});
