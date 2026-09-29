const checkRefusals = require('./check-pdf-contract-refusals.cjs');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const root = resolve(__dirname, '../../..');
const dist = [
  'dist/src/pdf-conversion/contracts',
  'dist/pdf-conversion/contracts',
]
  .map((p) => resolve(__dirname, '..', p))
  .find((p) => existsSync(resolve(p, 'validate-contract.js')));
if (!dist) throw new Error('Build the API before contract smoke');
const { validateContract } = require(resolve(dist, 'validate-contract.js'));
const { validateCompletion } = require(resolve(dist, 'validate-completion.js'));
const { pythonSemanticValidator } = require(
  resolve(dist, 'python-semantic-validator.js'),
);
const { negotiateReader } = require(resolve(dist, 'negotiate-reader.js'));
const semantic = pythonSemanticValidator(
  process.env.AVA_PDF_CONTRACT_PYTHON || '',
);
const names = [
  'ava-book-2',
  'ava-pdf-job-1',
  'ava-pdf-worker-result-1',
  'ava-accepted-content-1',
  'ava-reader-3',
];
const fixture = (name) =>
  readFileSync(
    resolve(root, 'packages/pdf-epub/tests/contracts/fixtures', name + '.json'),
  );
async function main() {
  const results = [];
  for (const name of names) {
    await validateContract(name, fixture(name), semantic);
    results.push(name + ': semantic pass');
  }
  const input = await validateContract(
    'ava-pdf-job-1',
    fixture('ava-pdf-job-1'),
    semantic,
  );
  const completion = await validateCompletion(
    input,
    { exitCode: 2, bytes: fixture('ava-pdf-worker-result-1') },
    semantic,
  );
  assert.equal(completion.outcome.publication_eligible, false);
  results.push('exit2 retained candidate');
  results.push(
    ...(await checkRefusals({
      fixture,
      validateContract,
      negotiateReader,
      semantic,
    })),
  );
  if (process.env.AVA_PDF_SMOKE_DIR) {
    const directory = resolve(process.env.AVA_PDF_SMOKE_DIR);
    const realJob = await validateContract(
      'ava-pdf-job-1',
      readFileSync(resolve(directory, 'contract-job.json')),
      semantic,
    );
    const realCompletion = await validateCompletion(
      realJob,
      {
        exitCode: 2,
        bytes: readFileSync(resolve(directory, 'contract-result.json')),
      },
      semantic,
    );
    assert.equal(realCompletion.outcome.status, 'candidate');
    assert.equal(realCompletion.outcome.canonical_schema, 'ava-book-1');
    assert.equal(realCompletion.outcome.publication_eligible, false);
    results.push(
      'real native CLI exit2: bound reviewable candidate, never Ready',
    );
  }
  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        method: 'built API + installed Python subprocess; no provider/DB/UI',
        checks: results,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
