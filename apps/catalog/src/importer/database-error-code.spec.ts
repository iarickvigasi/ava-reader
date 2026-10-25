import { databaseErrorCode } from './database-error-code';

describe('databaseErrorCode', () => {
  it('finds SQLSTATE beneath a Prisma request error code', () => {
    expect(
      databaseErrorCode({
        code: 'P2010',
        meta: {
          code: '57014',
          message: 'statement timeout',
        },
      }),
    ).toBe('57014');
  });

  it('ignores message text and missing codes', () => {
    expect(databaseErrorCode(new Error('57014'))).toBeUndefined();
    expect(databaseErrorCode(null)).toBeUndefined();
  });
});
