import {
  exchangeProtocol,
  exchangeReply,
  type ExchangeEnvelope,
} from './exchange-protocol';
import {
  geometryParent,
  geometryTask,
} from '../reconstruction/geometry-fixture';
const binding = {
  source_sha256: geometryParent.source_sha256,
  profile_id: geometryParent.profile_id,
};
function packet(
  sequence: number,
  kind: ExchangeEnvelope['kind'],
  payload: unknown,
  marker?: ExchangeEnvelope['schema_version'],
) {
  return Buffer.from(
    JSON.stringify({
      ...binding,
      sequence,
      kind,
      payload,
      schema_version:
        marker ??
        (kind === 'geometry'
          ? 'ava-recognition-geometry-exchange-1'
          : kind === 'anchor_context'
            ? 'ava-recognition-anchor-context-exchange-1'
            : 'ava-reconstruction-exchange-2'),
    }),
  );
}
const page = {
  schema_version: 'ava-prepare-result-4',
  tasks: [geometryParent],
};
it('admits the new control only in the selected geometry namespace and binds one reply', () => {
  const protocol = exchangeProtocol(binding, true, true);
  protocol.accept(packet(1, 'page', page));
  protocol.accept(
    packet(2, 'recognition', { task_id: geometryParent.task_id }),
  );
  const request = protocol.accept(packet(3, 'geometry', geometryTask));
  expect(() =>
    exchangeReply(
      Buffer.from(JSON.stringify({ ...request, payload: [] })),
      request,
    ),
  ).toThrow('INVALID_RESULT');
  expect(
    exchangeReply(
      Buffer.from(JSON.stringify({ ...request, payload: [{}] })),
      request,
    ).length,
  ).toBeGreaterThan(4);
  expect(() => protocol.accept(packet(4, 'geometry', geometryTask))).toThrow(
    'INVALID_RESULT',
  );
});
it('shares the opportunity when anchor context precedes a geometry injection', () => {
  const protocol = exchangeProtocol(binding, true, true);
  protocol.accept(packet(1, 'page', page));
  protocol.accept(
    packet(2, 'recognition', { task_id: geometryParent.task_id }),
  );
  protocol.accept(
    packet(3, 'anchor_context', {
      task_id: 'authored-context',
      original_task_id: geometryParent.task_id,
    }),
  );
  expect(() => protocol.accept(packet(4, 'geometry', geometryTask))).toThrow(
    'INVALID_RESULT',
  );
});
it.each([false, true])(
  'refuses geometry on old layout/word-wrap selection %s',
  (wrap) => {
    const protocol = exchangeProtocol(binding, wrap);
    expect(() => protocol.accept(packet(1, 'geometry', geometryTask))).toThrow(
      'INVALID_RESULT',
    );
  },
);
it('keeps old generic kinds closed against new task control injection', () => {
  const protocol = exchangeProtocol(binding, true, true);
  expect(() =>
    protocol.accept(
      packet(1, 'geometry', geometryTask, 'ava-reconstruction-exchange-2'),
    ),
  ).toThrow('INVALID_RESULT');
});
