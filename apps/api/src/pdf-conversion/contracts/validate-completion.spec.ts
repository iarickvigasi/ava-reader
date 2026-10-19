import { validateContract } from './validate-contract';
import { validateCompletion } from './validate-completion';
import { fixtureBytes } from './contract-fixtures';

const semantic = () => Promise.resolve(true);
describe('worker completion boundary', () => {
  it('retains reviewable exit2 without promoting it to readable content', async () => {
    const input = await validateContract(
      'ava-pdf-job-1',
      fixtureBytes('ava-pdf-job-1'),
      semantic,
    );
    const result = await validateCompletion(
      input,
      { exitCode: 2, bytes: fixtureBytes('ava-pdf-worker-result-1') },
      semantic,
    );
    expect(result.outcome.status).toBe('candidate');
    if (result.outcome.status === 'candidate')
      expect(result.outcome.publication_eligible).toBe(false);
  });
  it.each([
    'source_sha256',
    'config_sha256',
    'operation_id',
    'attempt_fence',
    'cancellation_epoch',
  ])('rejects stale or mismatched %s', async (key) => {
    const input = await validateContract(
      'ava-pdf-job-1',
      fixtureBytes('ava-pdf-job-1'),
      semantic,
    );
    const result = JSON.parse(
      fixtureBytes('ava-pdf-worker-result-1').toString(),
    ) as Record<string, unknown>;
    result[key] =
      typeof result[key] === 'number'
        ? result[key] + 1
        : key === 'operation_id'
          ? 'other-operation'
          : 'b'.repeat(64);
    await expect(
      validateCompletion(
        input,
        { exitCode: 2, bytes: Buffer.from(JSON.stringify(result)) },
        semantic,
      ),
    ).rejects.toThrow('INVALID_CONTRACT');
  });
  it('rejects missing output and a process exit that contradicts its envelope', async () => {
    const input = await validateContract(
      'ava-pdf-job-1',
      fixtureBytes('ava-pdf-job-1'),
      semantic,
    );
    for (const completion of [
      { exitCode: 2, bytes: Buffer.alloc(0) },
      { exitCode: 0, bytes: fixtureBytes('ava-pdf-worker-result-1') },
    ]) {
      await expect(
        validateCompletion(input, completion, semantic),
      ).rejects.toThrow('INVALID_CONTRACT');
    }
  });
});
