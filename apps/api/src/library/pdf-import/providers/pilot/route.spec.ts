import { loadAuthoredPilotRoute } from './route';
import { PILOT_IMAGE, PILOT_SOURCES } from './scope';
import { pilotFixture } from '../pilot-fixtures';
import { tariff } from '../test-fixtures';
import type { Tx } from '../../jobs/types';

const environment = {
  NODE_ENV: 'test',
  AVA_PDF_TEST_HOOKS: '1',
  AVA_PDF_AUTHORED_PILOT: '1',
  DATABASE_URL: 'postgresql://synthetic@127.0.0.1:50755/ava_pdf_authored_pilot',
};
function fixture() {
  const f = pilotFixture(),
    config = f.config;
  Object.assign(config, {
    maxContextTokens: 65536,
    maxOutputTokens: 16384,
    timeoutMs: 300000,
    operationLimitNano: '1000000000',
    authorizedSourceSha256: [PILOT_SOURCES[0]],
  });
  const pilot = config.pilotInventory,
    op = pilot.operations[0];
  pilot.workerFingerprint = PILOT_IMAGE;
  pilot.maxRequests = 2;
  op.sourceSha256 = PILOT_SOURCES[0];
  op.operationLimitNano = '398133900';
  op.tasks.push({ ...op.tasks[0], taskId: 'task-2' });
  const route = {
    ...f.route,
    mode: 'live',
    modelId: 'google/gemini-3.8-flash',
    providerSlug: 'google-vertex/global/priority',
    configuration: config,
    tariff: {
      ...tariff,
      promptPerMillionUsd: '1.35',
      completionPerMillionUsd: '6.75',
      imageUsd: '0.00000135',
    },
  };
  const tx = {
    pdfProviderRoute: { findUnique: jest.fn().mockResolvedValue(route) },
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce([{ name: 'ava_pdf_authored_pilot' }])
      .mockResolvedValueOnce([{ now: new Date() }]),
  } as unknown as Tx;
  return { tx, route, pilot, op, config };
}
describe('current finite authored refinement scope', () => {
  const previous = { ...process.env };
  beforeEach(() => Object.assign(process.env, environment));
  afterEach(() => {
    for (const key of Object.keys(environment)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  it('accepts the two source-bound comparisons through the actual route policy', async () => {
    const f = fixture();
    await expect(loadAuthoredPilotRoute(f.tx, 'route')).resolves.toMatchObject({
      pilot: f.pilot,
    });
  });
  it.each(['old image', 'old source', 'third task', 'different model'])(
    'refuses %s',
    async (change) => {
      const f = fixture();
      if (change === 'old image')
        f.pilot.workerFingerprint =
          '725dc4c5fee1d7addf289484d7def37d8d8aff43dceba16bfd18d0d8f1cb66d3';
      if (change === 'old source') {
        f.op.sourceSha256 =
          'ead57e233d0159460a7a8b63b15fe8ad8c9888be7a1989885a9536696c2d363b';
        f.config.authorizedSourceSha256 = [f.op.sourceSha256];
      }
      if (change === 'third task') {
        f.pilot.maxRequests = 3;
        f.op.tasks.push({ ...f.op.tasks[0], taskId: 'task-3' });
        f.op.operationLimitNano = '597200850';
      }
      if (change === 'different model') f.route.modelId = 'other/model';
      await expect(loadAuthoredPilotRoute(f.tx, 'route')).rejects.toThrow(
        'PDF_PROVIDER_PILOT_UNAUTHORIZED',
      );
    },
  );
});
