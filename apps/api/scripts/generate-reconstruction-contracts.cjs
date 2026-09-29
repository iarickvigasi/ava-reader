const { execFileSync } = require('node:child_process');
const { compile } = require('json-schema-to-typescript');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const prettier = require('prettier');
const source = resolve(__dirname, '../../../packages/pdf-epub/src');
const target = resolve(
  __dirname,
  '../src/pdf-conversion/reconstruction/generated',
);
const program = `
import json
from ava_pdf_epub.reconstruction_v2.protocol import PrepareResult, ReconstructionInput
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionTask, RecognitionResponse
from ava_pdf_epub.reconstruction_v2.recognition_prompt import SYSTEM_PROMPT, PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.report import ReconstructionReport
classes = [PrepareResult, ReconstructionInput, RecognitionTask, RecognitionResponse, ReconstructionReport]
print(json.dumps(dict(schemas={c.__name__: c.model_json_schema() for c in classes}, prompt=SYSTEM_PROMPT, promptVersion=PROMPT_VERSION),sort_keys=True,separators=(',',':')))
`;
async function emit(name, content) {
  const formatted = await prettier.format(content, {
    parser: 'typescript',
    singleQuote: true,
  });
  const file = resolve(target, name);
  if (process.argv.includes('--check')) {
    if (readFileSync(file, 'utf8') !== formatted)
      throw new Error('Stale recognition contract: ' + name);
  } else writeFileSync(file, formatted);
}
async function main() {
  const raw = execFileSync(
    process.env.AVA_PDF_CONTRACT_PYTHON || 'python3',
    ['-c', program],
    {
      env: { ...process.env, PYTHONPATH: source },
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const data = JSON.parse(raw.toString('utf8'));
  mkdirSync(target, { recursive: true });
  for (const [name, schema] of Object.entries(data.schemas))
    await emit(
      name + '.ts',
      await compile(schema, name, {
        bannerComment:
          '/* Generated from Python recognition models; do not edit. */',
        additionalProperties: false,
        maxItems: 0,
      }),
    );
  await emit(
    'schemas.ts',
    '/* Generated; do not edit. */\nexport const recognitionSchemas = ' +
      JSON.stringify(data.schemas) +
      ';\n',
  );
  await emit(
    'prompt.ts',
    '/* Generated; do not edit. */\nexport const RECOGNITION_PROMPT = ' +
      JSON.stringify(data.prompt) +
      ';\nexport const RECOGNITION_PROMPT_VERSION = ' +
      JSON.stringify(data.promptVersion) +
      ';\n',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
