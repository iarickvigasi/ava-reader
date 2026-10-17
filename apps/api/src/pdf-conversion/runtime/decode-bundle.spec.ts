import { fixtureBytes } from '../contracts/contract-fixtures';
import { validateContract } from '../contracts/validate-contract';
import { bundleFixture } from './bundle-fixture';
import { decodeBundle } from './decode-bundle';

const semantic = () => Promise.resolve(true);
const job = () =>
  validateContract('ava-pdf-job-1', fixtureBytes('ava-pdf-job-1'), semantic);
const response = (value: unknown) => ({
  exitCode: 2,
  stdout: Buffer.from(JSON.stringify(value)),
  faultAcknowledged: false,
});
describe('container artifact transport', () => {
  it('retains exact candidate bytes without publication authority', async () => {
    const output = await decodeBundle(
      await job(),
      response(bundleFixture()),
      semantic,
    );
    expect(output.artifacts).toHaveLength(3);
    const parsed = JSON.parse(output.completion.bytes.toString()) as {
      outcome: { publication_eligible: boolean };
    };
    expect(parsed.outcome.publication_eligible).toBe(false);
  });
  it.each([
    'missing',
    'extra',
    'duplicate',
    'changed',
    'base64',
    'fence',
    'path',
    'source',
  ])('rejects %s', async (kind) => {
    const fixture = bundleFixture();
    if (kind === 'missing') fixture.artifacts.pop();
    if (kind === 'extra')
      fixture.artifacts.push({ id: 'extra', base64: 'eA==' });
    if (kind === 'duplicate') fixture.artifacts[1] = fixture.artifacts[0];
    if (kind === 'changed') fixture.artifacts[0].base64 = 'eA==';
    if (kind === 'base64') fixture.artifacts[0].base64 += '\n';
    if (kind === 'fence') fixture.result.attempt_fence += 1;
    if (kind === 'source') fixture.result.source_sha256 = '1'.repeat(64);
    if (kind === 'path' && fixture.result.outcome.status === 'candidate')
      fixture.result.outcome.epub.path = '../escape';
    await expect(
      decodeBundle(await job(), response(fixture), semantic),
    ).rejects.toThrow('INVALID_RESULT');
  });
  it('requires the independent semantic validator and exact process exit', async () => {
    await expect(
      decodeBundle(await job(), response(bundleFixture()), () =>
        Promise.resolve(false),
      ),
    ).rejects.toThrow();
    await expect(
      decodeBundle(
        await job(),
        { ...response(bundleFixture()), exitCode: 0 },
        semantic,
      ),
    ).rejects.toThrow();
  });
});
