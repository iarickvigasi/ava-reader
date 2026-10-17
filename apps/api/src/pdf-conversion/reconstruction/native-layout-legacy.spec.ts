import { preparePages } from './prepare-pages';
import { refineBook } from './refine-book';
import type { CoordinatorDependencies } from './coordinator-types';
const sourceLayoutPolicy = 'ava-native-layout-1' as const;
it('refuses policy on unsupported per-page helpers before sandbox, provider or progress work', async () => {
  const deps = {
    sandbox: jest.fn(),
    dispatch: jest.fn(),
    progress: jest.fn(),
    stageArtifact: jest.fn(),
  } as CoordinatorDependencies;
  const sandboxInput = jest.fn();
  const base = {
    deps,
    sandboxInput,
    sourceSha256: 'a'.repeat(64),
    pageLimit: 1,
    providerMode: 'native',
    sourceLayoutPolicy,
  };
  await expect(preparePages(base)).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  await expect(refineBook({ ...base, responses: [] })).rejects.toThrow(
    'DISPATCH_NOT_AUTHORIZED',
  );
  expect(sandboxInput).not.toHaveBeenCalled();
  for (const f of [
    deps.sandbox,
    deps.dispatch,
    deps.progress,
    deps.stageArtifact,
  ])
    expect(f).not.toHaveBeenCalled();
});
