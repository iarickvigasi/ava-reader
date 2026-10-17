import { httpFailureDiagnostic } from './http-failure-diagnostic';

describe('safe HTTP failure classification', () => {
  const body = JSON.stringify({
    error: {
      message: 'private text',
      metadata: {
        limit_source: 'upstream_provider_shared_pool',
        raw: 'private provider detail',
      },
    },
    user_id: 'private-user',
  });
  it('keeps useful rate-limit fields without provider text or billing inference', () => {
    const diagnostic = httpFailureDiagnostic(429, true, body, '60', null);
    expect(diagnostic).toEqual({
      httpStatus: 429,
      complete: true,
      classification: 'RATE_LIMIT',
      limitSource: 'upstream_provider_shared_pool',
      retryAfterSeconds: 60,
    });
    expect(JSON.stringify(diagnostic)).not.toContain('private');
    expect(diagnostic).not.toHaveProperty('cost');
  });
  it('does not interpret incomplete JSON as a confirmed provider reason', () => {
    expect(httpFailureDiagnostic(429, false, body, null, null)).toEqual({
      httpStatus: 429,
      complete: false,
      classification: 'RATE_LIMIT',
    });
  });
  it.each(['unknown-private-source', 429, null])(
    'omits unrecognized source %s',
    (source) => {
      expect(
        httpFailureDiagnostic(
          402,
          true,
          JSON.stringify({
            error: {
              metadata: {
                limit_source: source,
              },
            },
          }),
          null,
          null,
        ),
      ).not.toHaveProperty('limitSource');
    },
  );
  it.each(['null', '[]', '{invalid', 'plain provider message'])(
    'handles body %s without leaking it',
    (value) => {
      expect(httpFailureDiagnostic(500, true, value, null, null)).toEqual({
        httpStatus: 500,
        complete: true,
        classification: 'HTTP_ERROR',
      });
    },
  );
  it('reads a bounded Retry-After HTTP date relative to the server date', () => {
    expect(
      httpFailureDiagnostic(
        429,
        true,
        '{}',
        'Sat, 03 Oct 2026 00:01:00 GMT',
        'Sat, 03 Oct 2026 00:00:00 GMT',
      ),
    ).toHaveProperty('retryAfterSeconds', 60);
  });
  it.each(['-1', '1.5', '86401', 'Infinity', 'bad date', '9'.repeat(100)])(
    'rejects unbounded or invalid retry hint %s',
    (retry) => {
      expect(
        httpFailureDiagnostic(429, true, '{}', retry, null),
      ).not.toHaveProperty('retryAfterSeconds');
    },
  );
});
