import {
  configuredJobPolicy,
  DEFAULT_JOB_POLICY,
  parseJobPolicy,
} from './policy';
import { matchesSecret, secretDigest } from './secrets';
describe('immutable bounded job policy and credentials', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });
  it('uses safe defaults and refuses production fault policies', () => {
    delete process.env.AVA_PDF_TEST_JOB_POLICY;
    expect(configuredJobPolicy()).toEqual(DEFAULT_JOB_POLICY);
    process.env.AVA_PDF_TEST_JOB_POLICY = '{}';
    process.env.NODE_ENV = 'production';
    expect(() => configuredJobPolicy()).toThrow('PDF_TEST_HOOKS_DISABLED');
  });
  it.each([
    'null',
    '[]',
    '1',
    '{"maxAttempts":4}',
    '{"leaseMs":0}',
    '{"unknown":true}',
  ])('refuses malformed override %s', (value) => {
    process.env.NODE_ENV = 'test';
    process.env.AVA_PDF_TEST_HOOKS = '1';
    process.env.AVA_PDF_TEST_JOB_POLICY = value;
    expect(() => configuredJobPolicy()).toThrow('PDF_JOB_POLICY_INVALID');
  });
  it('allows explicitly acknowledged bounded test timing', () => {
    process.env.NODE_ENV = 'test';
    process.env.AVA_PDF_TEST_HOOKS = '1';
    process.env.AVA_PDF_TEST_JOB_POLICY =
      '{"leaseMs":100,"totalTimeoutMs":1000,"retryDelayMs":0}';
    expect(configuredJobPolicy().leaseMs).toBe(100);
    expect(() =>
      parseJobPolicy({ ...DEFAULT_JOB_POLICY, principalConcurrency: 2 }),
    ).toThrow();
  });
  it('allows a complete book two hours but rejects an unbounded extension', () => {
    expect(DEFAULT_JOB_POLICY.totalTimeoutMs).toBe(7200000);
    expect(
      parseJobPolicy({ ...DEFAULT_JOB_POLICY, totalTimeoutMs: 7200000 })
        .totalTimeoutMs,
    ).toBe(7200000);
    expect(() =>
      parseJobPolicy({ ...DEFAULT_JOB_POLICY, totalTimeoutMs: 7200001 }),
    ).toThrow('PDF_JOB_POLICY_INVALID');
  });
  it('compares only bounded hashed secrets', () => {
    const token = 'a'.repeat(43);
    expect(matchesSecret(token, secretDigest(token))).toBe(true);
    expect(matchesSecret('b'.repeat(43), secretDigest(token))).toBe(false);
    expect(matchesSecret('short', secretDigest('short'))).toBe(false);
  });
});
