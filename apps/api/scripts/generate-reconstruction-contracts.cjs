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
from ava_pdf_epub.reconstruction_v2 import recognition_prompt, ordered_list_prompt
from ava_pdf_epub.reconstruction_v2.report import ReconstructionReport
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementTask, BookRefinementResponse, RefinementBatch
from ava_pdf_epub.reconstruction_v2.refinement_prompt import REFINEMENT_PROMPT, REFINEMENT_PROMPT_VERSION, BIBLIOGRAPHIC_PROMPT, LEGACY_REFINEMENT_PROMPT
classes = [PrepareResult, ReconstructionInput, RecognitionTask, RecognitionResponse, ReconstructionReport, BookRefinementTask, BookRefinementResponse, RefinementBatch]
prompts = [("RECOGNITION_PROMPT", recognition_prompt.SYSTEM_PROMPT), ("RECOGNITION_PROMPT_VERSION", recognition_prompt.PROMPT_VERSION)]
for prefix in ("MERGED_TABLE", "PINNED_TABLE", "EXPLICIT_STYLE", "PINNED_STYLE", "ANCHORED_STYLE", "PINNED_ANCHORED", "BOUNDARY_STYLE", "PINNED_BOUNDARY", "UNICODE_STYLE", "PINNED_UNICODE"):
    for suffix in ("_PROMPT", "_PROMPT_VERSION"):
        name = prefix + suffix
        prompts.append((name, getattr(recognition_prompt, name)))
for name in ("ORDERED_LIST_PROMPT", "ORDERED_LIST_PROMPT_VERSION", "PINNED_ORDERED_LIST_PROMPT", "PINNED_ORDERED_LIST_PROMPT_VERSION"):
    prompts.append((name, getattr(ordered_list_prompt, name)))
print(json.dumps(dict(schemas={c.__name__: c.model_json_schema() for c in classes}, prompts=prompts, legacyRefinementPrompt=LEGACY_REFINEMENT_PROMPT, refinementPrompt=REFINEMENT_PROMPT, refinementPromptVersion=REFINEMENT_PROMPT_VERSION, bibliographicPrompt=BIBLIOGRAPHIC_PROMPT),sort_keys=True,separators=(',',':')))
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
    'refinement-prompt.ts',
    '/* Generated; do not edit. */\nexport const REFINEMENT_PROMPT = ' +
      JSON.stringify(data.refinementPrompt) +
      ';\nexport const LEGACY_REFINEMENT_PROMPT = ' +
      JSON.stringify(data.legacyRefinementPrompt) +
      ';\nexport const REFINEMENT_PROMPT_VERSION = ' +
      JSON.stringify(data.refinementPromptVersion) +
      ';\nexport const BIBLIOGRAPHIC_PROMPT = ' +
      JSON.stringify(data.bibliographicPrompt) +
      ';\n',
  );
  await emit(
    'prompt.ts',
    '/* Generated; do not edit. */\n' +
      data.prompts
        .map(
          ([name, value]) =>
            'export const ' + name + ' = ' + JSON.stringify(value) + ';\n',
        )
        .join(''),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
