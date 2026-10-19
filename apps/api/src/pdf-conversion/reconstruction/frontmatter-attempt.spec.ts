import { titleAttempt } from './frontmatter-attempt-fixture';
import { titleTask, titleResponse } from './frontmatter-title-fixture';
import { reconstructionRequest } from './reconstruction-request';
import { refineBook } from './refine-book';

it('prevalidates Title2 before dispatch, validates its reply and completes exact Input7 coverage', async () => {
  const q = titleAttempt();
  await q.pages();
  await q.send('refinement_batch', q.batch);
  expect(q.dispatch).not.toHaveBeenCalled();
  const reply: unknown = JSON.parse(
    (await q.send('refinement', { task_id: titleTask.task_id })).toString(),
  );
  expect(reply).toMatchObject({ payload: [titleResponse] });
  expect(q.validateFrontmatterTitle.mock.calls).toEqual([
    [titleTask, null, q.controller.signal],
    [titleTask, titleResponse, q.controller.signal],
  ]);
  expect(q.validateFrontmatterTitle.mock.invocationCallOrder[0]).toBeLessThan(
    q.dispatch.mock.invocationCallOrder[0],
  );
  expect(q.dispatch.mock.calls[0][0]).toMatchObject({
    purpose: 'resolve_structure',
    maxOutputTokens: 3072,
  });
  await q.send('word_wrap_batch', q.wraps);
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toEqual({ pageCount: 7, taskCount: 0 });
  expect(reconstructionRequest(q.context, [], [titleResponse])).toMatchObject({
    schema_version: 'ava-reconstruct-input-7',
    source_title_policy: 'ava-frontmatter-title-1',
    refinements: [titleResponse],
  });
});
it('refuses Batch3 before dispatch under historical capture', async () => {
  const q = titleAttempt(false);
  await q.pages();
  await expect(q.send('refinement_batch', q.batch)).rejects.toThrow(
    'DISPATCH_NOT_AUTHORIZED',
  );
  expect(q.dispatch).not.toHaveBeenCalled();
});
it('refuses legacy batches and foreign source page coverage under the new capture', async () => {
  for (const payload of [
    {
      schema_version: 'ava-book-refinement-batch-1',
      source_sha256: titleTask.source_sha256,
      tasks: [],
    },
    {
      ...titleAttempt().batch,
      tasks: [{ ...titleTask, source_page_count: 6 }],
    },
  ]) {
    const q = titleAttempt();
    await q.pages();
    await expect(q.send('refinement_batch', payload)).rejects.toThrow();
    expect(q.dispatch).not.toHaveBeenCalled();
  }
});
it('refuses missing or failed semantic preflight before paid dispatch', async () => {
  for (const missing of [false, true]) {
    const q = titleAttempt();
    await q.pages();
    await q.send('refinement_batch', q.batch);
    if (missing) q.context.validateFrontmatterTitle = undefined;
    else
      q.validateFrontmatterTitle.mockRejectedValue(new Error('INVALID_RESULT'));
    await expect(
      q.send('refinement', { task_id: titleTask.task_id }),
    ).rejects.toThrow();
    expect(q.dispatch).not.toHaveBeenCalled();
  }
});
it('stops after a mismatched first reply and never advertises another paid decision', async () => {
  const q = titleAttempt();
  await q.pages();
  await q.send('refinement_batch', q.batch);
  q.dispatch.mockResolvedValue({
    output: JSON.stringify({
      ...titleResponse,
      selected_text_sha256: 'f'.repeat(64),
    }),
  });
  await expect(
    q.send('refinement', { task_id: titleTask.task_id }),
  ).rejects.toThrow('SOURCE_MISMATCH');
  await expect(
    q.send('refinement', { task_id: titleTask.task_id }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
it('blocks Batch3 in the legacy non-attempt refinement entry before dispatch', async () => {
  const q = titleAttempt();
  const deps = {
    ...q.context.deps,
    sandbox: jest.fn(() =>
      Promise.resolve({
        exitCode: 0,
        stdout: Buffer.from(JSON.stringify(q.batch)),
        faultAcknowledged: false,
        faultAcknowledgement: undefined,
      }),
    ),
  };
  await expect(
    refineBook({
      responses: [],
      sourceSha256: titleTask.source_sha256,
      providerMode: 'live',
      profileId: titleTask.profile_id,
      deps,
      sandboxInput: jest.fn(),
    }),
  ).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(q.dispatch).not.toHaveBeenCalled();
});
