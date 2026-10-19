import { refineBook } from './refine-book';
import { refinementSetup } from './refinement-test-setup';
import { refinementResponse } from './refinement-fixture';

it('qualified native-only structure incurs no provider calls', async () => {
  const { input, sandbox, dispatch } = refinementSetup();
  sandbox.mockResolvedValueOnce({
    exitCode: 0,
    faultAcknowledged: false,
    faultAcknowledgement: undefined,
    stdout: Buffer.from(
      JSON.stringify({
        schema_version: 'ava-book-refinement-batch-1',
        source_sha256: input.sourceSha256,
        tasks: [],
      }),
    ),
  });
  expect(
    await refineBook({ ...input, responses: [], providerMode: 'native' }),
  ).toEqual([]);
  expect(sandbox).toHaveBeenCalledTimes(1);
  expect(dispatch).not.toHaveBeenCalled();
});
it('dispatches source comparison only after semantic validation and revalidates decisions', async () => {
  const { input, dispatch, events } = refinementSetup();
  expect(await refineBook(input)).toEqual([refinementResponse]);
  expect(events).toEqual([
    'prepare_refinement',
    'validate_refinement',
    'dispatch',
    'validate_refinement',
  ]);
  expect(dispatch.mock.calls[0][0]).toMatchObject({
    purpose: 'resolve_structure',
    pageIndices: [0],
    schemaVersion: 'ava-book-refinement-response-3',
  });
});
it('a native-only authority cannot dispatch a requested comparison', async () => {
  const { input, dispatch } = refinementSetup();
  await expect(
    refineBook({ ...input, providerMode: 'native' }),
  ).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(dispatch).not.toHaveBeenCalled();
});
it('rechecks deadline immediately before dispatch', async () => {
  const { input, dispatch } = refinementSetup();
  let checks = 0;
  await expect(
    refineBook({
      ...input,
      sandboxInput: () => {
        if (++checks === 3) throw Error('expired');
        return input.sandboxInput();
      },
    }),
  ).rejects.toThrow('expired');
  expect(dispatch).not.toHaveBeenCalled();
});
it('a forged semantic receipt prevents dispatch', async () => {
  const { input, sandbox, dispatch } = refinementSetup();
  const original = sandbox.getMockImplementation()!;
  sandbox.mockImplementation(async (value) => {
    const result = await original(value);
    const packet = JSON.parse(value.auxiliaryBytes!.toString()) as {
      mode: string;
    };
    if (packet.mode === 'validate_refinement')
      result.stdout = Buffer.from(
        JSON.stringify({
          schema_version: 'ava-refinement-validation-1',
          valid: true,
          request_sha256: '0'.repeat(64),
        }),
      );
    return result;
  });
  await expect(refineBook(input)).rejects.toThrow('INVALID_RESULT');
  expect(dispatch).not.toHaveBeenCalled();
});
it('replacement prose is refused by the canonical schema, never silently stripped', async () => {
  const { input, dispatch } = refinementSetup();
  dispatch.mockResolvedValue({
    output: JSON.stringify({
      ...refinementResponse,
      decisions: [
        { ...refinementResponse.decisions[0], text: 'replacement text' },
      ],
    }),
  });
  await expect(refineBook(input)).rejects.toThrow('INVALID_RESULT');
  expect(dispatch).toHaveBeenCalledTimes(1);
});

it('native text alone does not bypass requested structure comparison', async () => {
  const { input, dispatch } = refinementSetup();
  expect(await refineBook({ ...input, responses: [] })).toEqual([
    refinementResponse,
  ]);
  expect(dispatch).toHaveBeenCalledTimes(1);
});
