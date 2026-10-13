import { exchangeProtocol, exchangeReply } from './exchange-protocol';
import { encode, envelope } from './exchange-test-fixture';
import {
  native,
  ocr,
  page,
  nativeFrame,
} from './native-structure-exchange-fixture';

it('requires one native response with exact shared reply sequence, marker and source binding', () => {
  const request = nativeFrame();
  for (const change of [
    { payload: [] },
    { payload: [{}, {}] },
    { schema_version: 'ava-reconstruction-exchange-1' },
    { sequence: 3 },
    { source_sha256: 'f'.repeat(64) },
  ])
    expect(() =>
      exchangeReply(encode({ ...request, payload: [{}], ...change }), request),
    ).toThrow('INVALID_RESULT');
  expect(() =>
    exchangeReply(encode({ ...request, payload: [{}] }), request),
  ).not.toThrow();
});

it('shares finite 25000 page-task slots and sequence limits across native and OCR task kinds', () => {
  const protocol = exchangeProtocol(envelope());
  let sequence = 0;
  for (let number = 1; number <= 500; number++) {
    const tasks = Array.from({ length: 50 }, (_, index) => ({
      schema_version: index % 2 ? ocr.schema_version : native.schema_version,
      task_id: `page-${number}-task-${index}`,
    }));
    protocol.accept(
      encode({ ...envelope(++sequence), payload: { ...page, tasks } }),
    );
    for (const task of tasks)
      protocol.accept(
        encode({
          ...envelope(
            ++sequence,
            task.schema_version === native.schema_version
              ? 'native_structure'
              : 'recognition',
          ),
          schema_version:
            task.schema_version === native.schema_version
              ? 'ava-native-structure-exchange-1'
              : 'ava-reconstruction-exchange-1',
          payload: { task_id: task.task_id },
        }),
      );
  }
  protocol.accept(encode(envelope(++sequence, 'refinement_batch')));
  protocol.accept(encode(envelope(++sequence, 'artifacts')));
  expect(sequence).toBe(25502);
  expect(() => protocol.accept(encode(nativeFrame(++sequence)))).toThrow(
    'INVALID_RESULT',
  );
});
