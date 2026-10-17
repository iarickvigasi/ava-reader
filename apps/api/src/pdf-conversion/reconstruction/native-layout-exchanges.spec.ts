import { attemptExchanges } from './attempt-exchanges';
import { prepared, task } from './test-fixture';
import type { AttemptContext } from './attempt-provider';
const policy = 'ava-native-layout-1';
function setup(layout: typeof policy | undefined) {
  const dispatch = jest.fn();
  const context = {
    sourceSha256: task.source_sha256,
    profileId: task.profile_id,
    providerMode: 'native',
    pageLimit: 500,
    sourceLayoutPolicy: layout,
    checkActive: () => {},
    deps: {
      dispatch,
      progress: jest.fn(),
      sandbox: jest.fn(),
      stageArtifact: jest.fn(),
    },
  } as AttemptContext;
  const state = attemptExchanges(context);
  let sequence = 0;
  const send = (kind: string, payload: unknown) =>
    state.exchange(
      Buffer.from(
        JSON.stringify({
          schema_version: 'ava-reconstruction-exchange-1',
          sequence: ++sequence,
          source_sha256: context.sourceSha256,
          profile_id: context.profileId,
          kind,
          payload,
        }),
      ),
      new AbortController().signal,
    );
  const page = {
    ...prepared,
    schema_version: 'ava-prepare-result-2',
    source_layout_policy: policy,
    native_segment_count: 2,
    tasks: [],
  };
  const batch = {
    schema_version: 'ava-book-refinement-batch-1',
    source_sha256: context.sourceSha256,
    tasks: [],
  };
  return { state, send, page, batch, dispatch };
}
it('preserves policy through complete zero-task Result2 pages and no provider dispatch', async () => {
  const q = setup(policy);
  await q.send('page', q.page);
  await q.send('refinement_batch', q.batch);
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toEqual({ pageCount: 1, taskCount: 0 });
  expect(q.dispatch).not.toHaveBeenCalled();
});
it.each(['old', 'missing', 'unknown', 'foreign'])(
  'refuses changed or absent Result2 policy %s',
  async (change) => {
    const q = setup(policy);
    const p: Record<string, unknown> = { ...q.page };
    if (change === 'old') {
      p.schema_version = 'ava-prepare-result-1';
      delete p.source_layout_policy;
    }
    if (change === 'missing') delete p.source_layout_policy;
    if (change === 'unknown') p.source_layout_policy = 'unknown';
    if (change === 'foreign') p.source_sha256 = 'b'.repeat(64);
    await expect(q.send('page', p)).rejects.toThrow();
    expect(q.dispatch).not.toHaveBeenCalled();
  },
);
it('rejects Result2 without captured coordinator policy', async () => {
  const q = setup(undefined);
  await expect(q.send('page', q.page)).rejects.toThrow();
  expect(q.dispatch).not.toHaveBeenCalled();
});

it('refuses a later old-version page in a zero-task current-policy stream', async () => {
  const q = setup(policy);
  await q.send('page', { ...q.page, source_page_count: 2 });
  await expect(
    q.send('page', {
      ...prepared,
      source_page_count: 2,
      page_number: 2,
      tasks: [],
    }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).not.toHaveBeenCalled();
});
