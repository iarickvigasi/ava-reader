import {
  native,
  ocr,
  page,
  nativeFrame,
} from './native-structure-exchange-fixture';
import { exchangeProtocol } from './exchange-protocol';
import { encode, envelope } from './exchange-test-fixture';
it('keeps page acknowledgements on Exchange1 and binds native kind to its own marker and advertised task', () => {
  const protocol = exchangeProtocol(envelope());
  protocol.accept(encode({ ...envelope(), payload: page }));
  expect(() =>
    protocol.accept(
      encode({
        ...nativeFrame(),
        schema_version: 'ava-reconstruction-exchange-1',
      }),
    ),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    protocol.accept(
      encode({
        ...envelope(2, 'recognition'),
        payload: { task_id: native.task_id },
      }),
    ),
  ).toThrow('INVALID_RESULT');
  protocol.accept(encode(nativeFrame()));
  expect(() =>
    protocol.accept(
      encode({ ...nativeFrame(3), payload: { task_id: ocr.task_id } }),
    ),
  ).toThrow('INVALID_RESULT');
  protocol.accept(
    encode({
      ...envelope(3, 'recognition'),
      payload: { task_id: ocr.task_id },
    }),
  );
  protocol.accept(
    encode({ ...envelope(4, 'refinement_batch'), payload: { tasks: [] } }),
  );
  protocol.accept(encode(envelope(5, 'artifacts')));
});

it.each(['ava-prepare-result-1', 'ava-prepare-result-2', undefined])(
  'refuses native task advertisement in historical page %s',
  (schema_version) => {
    expect(() =>
      exchangeProtocol(envelope()).accept(
        encode({ ...envelope(), payload: { schema_version, tasks: [native] } }),
      ),
    ).toThrow('INVALID_RESULT');
  },
);

it('refuses wrong native marker phase, unknown current task versions and anchor correction after native decisions', () => {
  for (const value of [
    {
      ...envelope(),
      schema_version: 'ava-native-structure-exchange-1',
      payload: page,
    },
    {
      ...envelope(),
      payload: { ...page, tasks: [{ ...native, schema_version: 'unknown' }] },
    },
  ])
    expect(() => exchangeProtocol(envelope()).accept(encode(value))).toThrow(
      'INVALID_RESULT',
    );
  const protocol = exchangeProtocol(envelope());
  protocol.accept(encode({ ...envelope(), payload: page }));
  protocol.accept(encode(nativeFrame()));
  expect(() =>
    protocol.accept(
      encode({
        ...envelope(3, 'anchor_context'),
        schema_version: 'ava-recognition-anchor-context-exchange-1',
        payload: { task_id: 'correction', original_task_id: native.task_id },
      }),
    ),
  ).toThrow('INVALID_RESULT');
});
