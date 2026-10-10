import { validateContract } from './validate-contract';
import { validateCompletion } from './validate-completion';
import { fixtureBytes } from './contract-fixtures';

const semantic = () => Promise.resolve(true);
describe('completion trusted job context', () => {
  it('pins supplied job and exit correlation before asynchronous validation', async () => {
    const input = await validateContract(
      'ava-pdf-job-1',
      fixtureBytes('ava-pdf-job-1'),
      semantic,
    );
    const payload = JSON.parse(
      fixtureBytes('ava-pdf-worker-result-1').toString(),
    ) as Record<string, unknown>;
    payload.attempt_fence = 2;
    const completion = {
      exitCode: 0,
      bytes: Buffer.from(JSON.stringify(payload)),
    };
    let finish!: (value: boolean) => void;
    const gate = new Promise<boolean>((resolve) => {
      finish = resolve;
    });
    const pending = validateCompletion(input, completion, () => gate);
    input.attempt_fence = 2;
    completion.exitCode = 2;
    finish(true);
    await expect(pending).rejects.toThrow('INVALID_CONTRACT');
  });
  it('rejects artifacts exceeding the exact job scratch budget', async () => {
    const input = await validateContract(
      'ava-pdf-job-1',
      fixtureBytes('ava-pdf-job-1'),
      semantic,
    );
    input.scratch_byte_limit = 383;
    await expect(
      validateCompletion(
        input,
        { exitCode: 2, bytes: fixtureBytes('ava-pdf-worker-result-1') },
        semantic,
      ),
    ).rejects.toThrow('INVALID_CONTRACT');
    input.scratch_byte_limit = 384;
    await expect(
      validateCompletion(
        input,
        { exitCode: 2, bytes: fixtureBytes('ava-pdf-worker-result-1') },
        semantic,
      ),
    ).resolves.toHaveProperty('outcome.status', 'candidate');
  });
  it('rejects an invalid budget mutated after initial job validation', async () => {
    const input = await validateContract(
      'ava-pdf-job-1',
      fixtureBytes('ava-pdf-job-1'),
      semantic,
    );
    input.scratch_byte_limit = Number.NaN;
    await expect(
      validateCompletion(
        input,
        { exitCode: 2, bytes: fixtureBytes('ava-pdf-worker-result-1') },
        semantic,
      ),
    ).rejects.toThrow('INVALID_CONTRACT');
  });
});
