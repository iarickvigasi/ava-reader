import {
  correctAttemptGeometry,
  type AttemptContext,
} from './attempt-provider';
import {
  geometryTask,
  geometryParent,
  geometryAnswer,
  geometryOriginal,
  geometryOriginalJson,
} from './cell-geometry-fixture';
import { localPeer, localPolicies } from './local-cell-geometry-fixture';
import { PdfRuntimeError } from '../runtime/runtime-error';

function setup(proved = true, selected = true) {
  const dispatch = jest.fn(() =>
    Promise.resolve({
      output: JSON.stringify(geometryAnswer),
    }),
  );
  const local = jest.fn(() => Promise.resolve(localPeer(proved)));
  const preflight = jest.fn(() => Promise.resolve());
  const context: AttemptContext = {
    ...localPolicies,
    localCellGeometryPolicy: selected
      ? localPolicies.localCellGeometryPolicy
      : undefined,
    sourceSha256: geometryTask.source_sha256,
    profileId: geometryTask.profile_id,
    providerMode: 'live',
    pageLimit: 500,
    checkActive: () => undefined,
    validateGeometry: preflight,
    localizeCellGeometry: local,
    deps: {
      dispatch,
      sandbox: jest.fn(),
      stageArtifact: jest.fn(),
      progress: jest.fn(),
    },
  };
  const run = () =>
    correctAttemptGeometry(
      geometryTask,
      geometryParent,
      geometryOriginal,
      geometryOriginalJson,
      context,
      new AbortController().signal,
    );
  return { context, run, local, preflight, dispatch };
}
it('accepts a local proposal only after eligibility and never bills a provider', async () => {
  const q = setup();
  const result = await q.run();
  expect(result.corrected).not.toBeNull();
  expect(result.response).toEqual(geometryAnswer);
  expect(q.preflight.mock.invocationCallOrder[0]).toBeLessThan(
    q.local.mock.invocationCallOrder[0],
  );
  expect(q.dispatch).not.toHaveBeenCalled();
});
it('uses the one existing provider path only after clean NO_PROOF', async () => {
  const q = setup(false);
  await q.run();
  expect(q.local).toHaveBeenCalledTimes(1);
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
it('keeps old captures on the exact original provider path', async () => {
  const q = setup(true, false);
  await q.run();
  expect(q.local).not.toHaveBeenCalled();
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
it('does not take a provider fallback after local corruption or local response refusal', async () => {
  for (const kind of ['error', 'box', 'unresolved']) {
    const q = setup();
    if (kind === 'error')
      q.local.mockRejectedValue(new PdfRuntimeError('SOURCE_MISMATCH'));
    else {
      const local = localPeer(),
        bad = structuredClone(geometryAnswer);
      if (kind === 'box') bad.patches[0].box.y1 = 1001;
      else
        Object.assign(bad, {
          outcome: 'unresolved',
          patches: [],
          unresolved_reason: 'IMAGE_UNCLEAR',
        });
      local.response_json = JSON.stringify(bad);
      q.local.mockResolvedValue(local);
    }
    await expect(q.run()).rejects.toThrow();
    expect(q.dispatch).not.toHaveBeenCalled();
  }
});
it('refuses incomplete current policy or failed preflight before local/model work', async () => {
  const q = setup();
  q.context.sourceContinuationPolicy = undefined;
  await expect(q.run()).rejects.toThrow();
  expect(q.local).not.toHaveBeenCalled();
  expect(q.dispatch).not.toHaveBeenCalled();
  const r = setup();
  r.preflight.mockRejectedValue(new Error('eligibility'));
  await expect(r.run()).rejects.toThrow();
  expect(r.local).not.toHaveBeenCalled();
});
