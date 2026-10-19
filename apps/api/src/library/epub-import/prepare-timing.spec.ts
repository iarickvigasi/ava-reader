import { prepareCanonicalEpub } from './prepare-import';
import { EpubLeaseExpired } from './errors';
import { runSandbox } from '../../pdf-conversion/runtime/run-sandbox';
import type { EpubPhase } from './phase';
jest.mock('../../pdf-conversion/runtime/run-sandbox');
it('records a delivered lease-expired supervisor receipt as failed sandbox work, not successful work', async () => {
  jest.mocked(runSandbox).mockImplementation(async (input) => {
    await input.onStdout!(
      Buffer.from('{"version":"ava-runtime-error-1","code":"LEASE_EXPIRED"}\n'),
    );
    return { exitCode: 1 } as never;
  });
  const observations: { stage: string; code?: string }[] = [];
  const phase: EpubPhase = async (stage, work) => {
    try {
      const result = await work();
      observations.push({ stage });
      return result;
    } catch (error) {
      observations.push({
        stage,
        code: error instanceof EpubLeaseExpired ? error.code : 'OTHER',
      });
      throw error;
    }
  };
  const semantic = jest.fn();
  await expect(
    prepareCanonicalEpub({
      bytes: Buffer.from('owned EPUB fixture'),
      finalContentId: 'content',
      runtime: {} as never,
      semantic,
      phase,
    }),
  ).rejects.toBeInstanceOf(EpubLeaseExpired);
  expect(observations).toEqual([
    { stage: 'EPUB_SANDBOX', code: 'LEASE_EXPIRED' },
  ]);
  expect(semantic).not.toHaveBeenCalled();
  expect(runSandbox).toHaveBeenCalledTimes(1);
});
