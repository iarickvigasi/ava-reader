import { BadRequestException } from '@nestjs/common';
import { parseBrowseQuery } from './browse-query';

describe('public catalog query boundaries', () => {
  it.each([
    { query: ['one', 'two'] },
    { filters: 'admin' },
    { filters: 'description' },
    { limit: '0' },
    { limit: '41' },
    { limit: '1.5' },
    { languages: 'en,../../' },
    { query: 'x'.repeat(201) },
    { cursor: 'invalid' },
    { before: 'invalid' },
    {
      before: '00000000-0000-4000-8000-000000000001',
      cursor: '00000000-0000-4000-8000-000000000002',
    },
    { languages: Array(21).fill('en').join(',') },
  ])('rejects malformed or unbounded input %j', (input) => {
    expect(() => parseBrowseQuery(input)).toThrow(BadRequestException);
  });
});
