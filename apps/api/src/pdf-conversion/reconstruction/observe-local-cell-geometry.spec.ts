import type { WorkerObserver } from '../runtime/worker-observer';
import type { AttemptContext } from './attempt-provider';
import { geometryTask } from './cell-geometry-fixture';
import { localPeer } from './local-cell-geometry-fixture';
import { observeLocalCellGeometry } from './observe-local-cell-geometry';
import { safeEventSchema } from '../../library/pdf-import/reports/event-contract';

it.each([true, false])(
  'retains content-free local proof and explicit zero provider cost for proved=%s',
  (proved) => {
    const emit = jest.fn<
      ReturnType<WorkerObserver['emit']>,
      Parameters<WorkerObserver['emit']>
    >();
    const observer = {
      emit,
      nextUnit: () => 'unit-local-1',
    } as unknown as WorkerObserver;
    observeLocalCellGeometry(geometryTask, localPeer(proved), {
      deps: { observer },
    } as AttemptContext);
    const [kind, stage, , details] = emit.mock.calls[0];
    const event = safeEventSchema.parse({
      kind,
      stage,
      details: { sourceSha256: geometryTask.source_sha256, ...details },
    });
    expect(event.details.localCellGeometry).toHaveProperty(
      'origin',
      'LOCAL_OCR',
    );
    expect(event.details.localCellGeometry).toHaveProperty('providerCalls', 0);
    expect(event.details.localCellGeometry).toHaveProperty(
      'providerCostNano',
      '0',
    );
    expect(JSON.stringify(event)).not.toContain('tsv_base64');
    expect(JSON.stringify(event)).not.toContain(
      'authored local transport peer',
    );
    const invalid = structuredClone(event);
    invalid.details.localCellGeometry!.reason = proved
      ? 'NO_UNIQUE_SOURCE_LINE'
      : null;
    expect(safeEventSchema.safeParse(invalid).success).toBe(false);
  },
);
