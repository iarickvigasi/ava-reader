import type { PrismaService } from '../../../prisma/prisma.service';
import { dispatchPdfProvider } from './dispatch';
import { dispatchPdfProviderReceipt } from './dispatch-receipt';
import { prepareProviderRequest } from './prepare-request';
import {
  observationTask,
  observationRoute,
  observationResponse,
} from './recognition-observation-fixture';
import {
  figureResponse,
  prepareFigure,
  figureAnswer,
} from './figure-alt-fixture';
jest.mock('./dispatch-receipt', () => ({
  dispatchPdfProviderReceipt: jest.fn(),
}));
const send = jest.mocked(dispatchPdfProviderReceipt);
const prisma = {} as PrismaService;
const authority = {
  principalId: 'p',
  token: 't',
  attemptId: 'a',
  attemptToken: 't',
};
const prepared = prepareProviderRequest(observationRoute, observationTask);
const receipt = {
  callId: 'original-call',
  generationId: 'original-generation',
  actualNano: '17',
  reused: false,
  output: JSON.stringify(figureResponse()),
};
beforeEach(() => jest.resetAllMocks());
function first(output = receipt.output, reused = false) {
  send.mockResolvedValueOnce({
    receipt: { ...receipt, output, reused },
    prepared,
  });
}
it.each([false, true])(
  'preserves parent reused=%p while charging one fresh correction',
  async (parentReused) => {
    first(receipt.output, parentReused);
    const signal = new AbortController().signal;
    send.mockImplementationOnce((_, input) => {
      // Prepare the answer from the actual deterministic task supplied by the wrapper.
      const r = prepareFigure();
      const part = input.task.messages[1].content;
      if (typeof part === 'string' || part[0].type !== 'text')
        throw Error('fixture');
      const ctx = JSON.parse(part[0].text) as {
        parent_output_sha256: string;
        parent_call_id: string;
      };
      const answer = {
        ...figureAnswer(r),
        task_id: input.task.taskId,
        parent_output_sha256: ctx.parent_output_sha256,
      };
      expect(ctx.parent_call_id).toBe(receipt.callId);
      expect(input.signal).toBe(signal);
      expect(input.authority).toEqual(authority);
      return Promise.resolve({
        receipt: {
          ...receipt,
          callId: 'repair-call',
          output: JSON.stringify(answer),
        },
        prepared,
      });
    });
    const result = await dispatchPdfProvider(prisma, {
      task: observationTask,
      authority,
      signal,
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      callId: 'original-call',
      actualNano: '17',
      repairCallId: 'repair-call',
      reused: parentReused,
      repairReused: false,
    });
    expect(result.output).toContain('Two aligned rows');
  },
);
it.each([
  'PDF_PROVIDER_OUTCOME_UNCERTAIN',
  'PDF_PROVIDER_BUDGET_EXCEEDED',
  'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
  'PDF_PROVIDER_NOT_DISPATCHED',
])('never retries after correction %s', async (code) => {
  first();
  send.mockRejectedValueOnce(new Error(code));
  await expect(
    dispatchPdfProvider(prisma, { task: observationTask, authority }),
  ).rejects.toThrow(code);
  expect(send).toHaveBeenCalledTimes(2);
});
it('does not send another call for a malformed correction', async () => {
  first();
  send.mockResolvedValueOnce({
    receipt: { ...receipt, output: '{}' },
    prepared,
  });
  await expect(
    dispatchPdfProvider(prisma, { task: observationTask, authority }),
  ).rejects.toThrow();
  expect(send).toHaveBeenCalledTimes(2);
});
it.each([JSON.stringify(observationResponse), '{}'])(
  'does not repair valid or unrelated invalid output',
  async (output) => {
    first(output);
    await dispatchPdfProvider(prisma, {
      task: observationTask,
      authority,
    }).catch(() => undefined);
    expect(send).toHaveBeenCalledTimes(1);
  },
);
it('does not repair unsettled or incomplete original calls', async () => {
  send.mockRejectedValueOnce(new Error('PDF_PROVIDER_OUTCOME_UNCERTAIN'));
  await expect(
    dispatchPdfProvider(prisma, { task: observationTask, authority }),
  ).rejects.toThrow('PDF_PROVIDER_OUTCOME_UNCERTAIN');
  expect(send).toHaveBeenCalledTimes(1);
});
