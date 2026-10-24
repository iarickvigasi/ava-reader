import assert from 'node:assert/strict';

export async function verifyBrowseValidation(
  get: (path: string) => Promise<Response>,
) {
  for (const query of [
    'filters=unknown',
    'query=a&query=b',
    'languages=../en',
    'cursor=wrong',
  ]) {
    assert.equal((await get(`/works?${query}`)).status, 400);
  }
  const facets = (await (await get('/works/filters')).json()) as {
    languages: string[];
  };
  assert.ok(facets.languages.includes('en') && facets.languages.includes('ru'));
}
