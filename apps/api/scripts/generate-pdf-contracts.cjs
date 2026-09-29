// Generated artifacts are checked into API source so Nest builds without Python.
const { compile } = require('json-schema-to-typescript');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const names = [
  'ava-book-2',
  'ava-pdf-job-1',
  'ava-pdf-worker-result-1',
  'ava-accepted-content-1',
  'ava-reader-3',
];
const source = resolve(
  __dirname,
  '../../../packages/pdf-epub/src/ava_pdf_epub/contracts/schemas',
);
const target = resolve(__dirname, '../src/pdf-conversion/contracts/generated');
async function main() {
  mkdirSync(target, { recursive: true });
  const schemas = {};
  for (const name of names) {
    const schema = JSON.parse(
      readFileSync(resolve(source, name + '.schema.json'), 'utf8'),
    );
    schemas[name] = schema;
    const types = await compile(schema, schema.title, {
      bannerComment: '/* Generated from worker JSON Schema; do not edit. */',
      additionalProperties: false,
      maxItems: 0,
    });
    const prettier = require('prettier');
    emit(
      name + '.ts',
      await prettier.format(types, { parser: 'typescript', singleQuote: true }),
    );
  }
  const prettier = require('prettier');
  emit(
    'schemas.ts',
    await prettier.format(
      '/* Generated; do not edit. */\nexport const contractSchemas = ' +
        JSON.stringify(schemas) +
        ';\n',
      { parser: 'typescript', singleQuote: true },
    ),
  );
}
function emit(name, content) {
  const path = resolve(target, name);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== content)
      throw new Error('Stale generated contract: ' + name);
  } else writeFileSync(path, content);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
