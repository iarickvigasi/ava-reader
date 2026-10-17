import { exchangeProtocol } from './exchange-protocol';
import { encode, envelope } from './exchange-test-fixture';

export function wordWrapExchange() {
  const protocol = exchangeProtocol(envelope(), true);
  let sequence = 0;
  const emit = (
    kind: string,
    payload: unknown,
    marker = 'ava-reconstruction-exchange-2',
  ) =>
    protocol.accept(
      encode({
        ...envelope(),
        schema_version: marker,
        sequence: ++sequence,
        kind,
        payload,
      }),
    );
  const page = () =>
    emit('page', { schema_version: 'ava-prepare-result-4', tasks: [] });
  const refinement = () => emit('refinement_batch', { tasks: [] });
  const batch = (ids: string[] = []) =>
    emit('word_wrap_batch', {
      schema_version: 'ava-native-word-wrap-batch-1',
      tasks: ids.map((id) => ({
        schema_version: 'ava-native-word-wrap-task-1',
        task_id: id,
      })),
    });
  return { protocol, emit, page, refinement, batch };
}
