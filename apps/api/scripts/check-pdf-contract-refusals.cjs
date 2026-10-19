const assert = require('node:assert/strict');

module.exports = async function checkRefusals({
  fixture,
  validateContract,
  negotiateReader,
  semantic,
}) {
  const results = [];
  const duplicate = Buffer.from(
    fixture('ava-pdf-job-1').toString().replace('{', '{"generation":99,'),
  );
  await assert.rejects(
    validateContract('ava-pdf-job-1', duplicate, semantic),
    /INVALID_CONTRACT/,
  );
  results.push('duplicate wire key rejected');
  const book = JSON.parse(fixture('ava-book-2'));
  book.blocks[0].content.sha256 = 'f'.repeat(64);
  await assert.rejects(
    validateContract('ava-book-2', Buffer.from(JSON.stringify(book)), semantic),
    /INVALID_CONTRACT/,
  );
  results.push('forged text hash rejected');
  const v3 = JSON.parse(fixture('ava-reader-3'));
  assert.equal(
    (
      await negotiateReader(
        fixture('ava-reader-3'),
        { versions: [2], capabilities: [] },
        semantic,
      )
    ).status,
    'upgrade_required',
  );
  assert.equal(
    (
      await negotiateReader(
        fixture('ava-reader-3'),
        { versions: [3], capabilities: [] },
        semantic,
      )
    ).status,
    'upgrade_required',
  );
  assert.equal(
    (
      await negotiateReader(
        fixture('ava-reader-3'),
        { versions: [3], capabilities: v3.required_capabilities },
        semantic,
      )
    ).status,
    'compatible',
  );
  results.push('version/capability negotiation passed');
  return results;
};
