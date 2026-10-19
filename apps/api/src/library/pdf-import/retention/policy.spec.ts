import { pdfRetentionPolicy, pdfRetentionSummary } from './policy';
import { requirePdfRetentionInterval } from './activation';
describe('dormant retention policy', () => {
  const original = { ...process.env };
  beforeEach(() => {
    for (const key of Object.keys(process.env))
      if (
        key.startsWith('AVA_PDF_RETENTION') ||
        key.startsWith('AVA_PDF_TEST_RETENTION')
      )
        delete process.env[key];
  });
  afterEach(() => {
    process.env = { ...original };
  });
  it('reports eligibility, not an erasure SLA', () => {
    expect(pdfRetentionSummary()).toEqual({
      deletedGraceHours: 24,
      failedWorkDays: 7,
      timing: 'eligible_after',
      backups: 'may_remain_longer',
    });
  });
  it('has no enabled production deletion path', () => {
    process.env.NODE_ENV = 'production';
    process.env.AVA_PDF_TEST_HOOKS = '1';
    process.env.AVA_PDF_TEST_RETENTION_ENABLED = '1';
    expect(() => requirePdfRetentionInterval(1000)).toThrow(
      'PDF_RETENTION_NOT_ENABLED',
    );
  });
  it.each(['0', '-1', 'NaN', '721'])(
    'refuses invalid configured grace %s',
    (value) => {
      process.env.AVA_PDF_RETENTION_DELETED_HOURS = value;
      expect(() => pdfRetentionPolicy()).toThrow();
    },
  );
  it('permits bounded isolated clock fixtures only explicitly', () => {
    process.env.AVA_PDF_TEST_RETENTION_POLICY = JSON.stringify({
      deletedGraceMs: 1000,
      failedWorkMs: 2000,
    });
    process.env.AVA_PDF_TEST_HOOKS = '0';
    expect(() => pdfRetentionPolicy()).toThrow();
    process.env.AVA_PDF_TEST_HOOKS = '1';
    process.env.AVA_PDF_TEST_RETENTION_ENABLED = '1';
    expect(pdfRetentionPolicy().deletedGraceMs).toBe(1000);
    expect(() => requirePdfRetentionInterval(-1)).toThrow(
      'PDF_RETENTION_INTERVAL_INVALID',
    );
    expect(() => requirePdfRetentionInterval(1000)).not.toThrow();
  });
});
