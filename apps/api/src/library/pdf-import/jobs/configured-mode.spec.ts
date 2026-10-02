import { configuredPdfMode } from './configured-mode';
const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});
beforeEach(() => {
  delete process.env.AVA_PDF_TEST_PROVIDER_MODE;
  delete process.env.AVA_PDF_PROVIDER_ROUTE_ID;
});
it('keeps native as the default and selects only an explicit server route', () => {
  expect(configuredPdfMode()).toBe('native');
  process.env.AVA_PDF_PROVIDER_ROUTE_ID = 'verified-route';
  expect(configuredPdfMode()).toBe('live');
});
it('rejects empty route and conflicting test mode', () => {
  process.env.AVA_PDF_PROVIDER_ROUTE_ID = '';
  expect(configuredPdfMode).toThrow();
  process.env.AVA_PDF_PROVIDER_ROUTE_ID = 'route';
  process.env.AVA_PDF_TEST_PROVIDER_MODE = 'stub';
  expect(configuredPdfMode).toThrow();
});
it('keeps test overrides fenced away from production', () => {
  process.env.NODE_ENV = 'production';
  process.env.AVA_PDF_TEST_PROVIDER_MODE = 'replay';
  expect(configuredPdfMode).toThrow('PDF_TEST_HOOKS_DISABLED');
});
