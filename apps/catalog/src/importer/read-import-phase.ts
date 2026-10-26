import { databaseErrorCode } from './database-error-code';
import type { ImportContext } from './import-operation';

type Phase = 'pendingIds' | 'unresolvedIds' | 'payloads';

export async function readImportPhase<T>(
  context: ImportContext,
  phase: Phase,
  action: () => Promise<T[]>,
) {
  context.phase = phase;
  context.databaseOperation = 'importRecord.findMany';
  const started = performance.now();
  console.log(
    JSON.stringify({ ...context, event: 'importRead', state: 'started' }),
  );
  try {
    const rows = await action();
    console.log(
      JSON.stringify({
        ...context,
        event: 'importRead',
        state: 'completed',
        elapsedMs: performance.now() - started,
        records: rows.length,
      }),
    );
    return rows;
  } catch (error) {
    console.error(
      JSON.stringify({
        ...context,
        event: 'importRead',
        state: 'failed',
        elapsedMs: performance.now() - started,
        databaseCode: databaseErrorCode(error),
      }),
    );
    throw error;
  }
}
