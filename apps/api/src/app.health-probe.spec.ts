import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const compose = readFileSync(
  resolve(__dirname, '../../../compose.yaml'),
  'utf8',
);
const api = compose.split('\n  api:\n')[1]?.split('\n  web:\n')[0];
const command = api?.match(
  /\[\s*"CMD",\s*"node",\s*"-e",\s*("(?:[^"\\]|\\.)*")\s*\]/,
);
if (!command) throw new Error('API Compose health probe was not found');
const probe = JSON.parse(command[1]) as string;
const healthy = { service: 'api', status: 'ok', database: 'up' };

function runProbe(body: string, status = 200) {
  return spawnSync(
    process.execPath,
    [
      '-e',
      `globalThis.fetch = async (url) => {
        if (url !== 'http://127.0.0.1:4000/api/health') throw new Error('unexpected URL');
        return new Response(${JSON.stringify(body)}, { status: ${status} });
      }; ${probe}`,
    ],
    { timeout: 2000, encoding: 'utf8', env: {} },
  );
}

describe('actual Compose API readiness probe', () => {
  it('accepts only a healthy response from the expected API service', () => {
    expect(runProbe(JSON.stringify(healthy)).status).toBe(0);
  });

  it.each([
    ['failed dependency', { ...healthy, status: 'degraded', database: 'down' }],
    ['database down with ok status', { ...healthy, database: 'down' }],
    ['unknown status', { ...healthy, status: 'unknown' }],
    ['unknown database state', { ...healthy, database: 'unknown' }],
    ['foreign service', { ...healthy, service: 'other' }],
    ['missing status and database', { service: 'api' }],
    ['null payload', null],
    ['array payload', [healthy]],
  ])('rejects %s even with HTTP 200', (_label, payload) => {
    expect(runProbe(JSON.stringify(payload)).status).toBe(1);
  });

  it.each(['invalid JSON', ''])('rejects malformed JSON %j', (body) => {
    expect(runProbe(body).status).toBe(1);
  });

  it('rejects an HTTP error even if its payload claims healthy', () => {
    expect(runProbe(JSON.stringify(healthy), 503).status).toBe(1);
  });

  it('rejects a failed request', () => {
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `globalThis.fetch = async () => { throw new Error('unavailable'); }; ${probe}`,
      ],
      { timeout: 2000, encoding: 'utf8', env: {} },
    );
    expect(result.status).toBe(1);
  });
});
