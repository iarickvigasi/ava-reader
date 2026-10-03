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
from ava_pdf_epub.reconstruction_v2.recognition_prompt import SYSTEM_PROMPT, PROMPT_VERSION, MERGED_TABLE_PROMPT, MERGED_TABLE_PROMPT_VERSION, PINNED_TABLE_PROMPT, PINNED_TABLE_PROMPT_VERSION, EXPLICIT_STYLE_PROMPT, EXPLICIT_STYLE_PROMPT_VERSION, PINNED_STYLE_PROMPT, PINNED_STYLE_PROMPT_VERSION, ANCHORED_STYLE_PROMPT, ANCHORED_STYLE_PROMPT_VERSION, PINNED_ANCHORED_PROMPT, PINNED_ANCHORED_PROMPT_VERSION, BOUNDARY_STYLE_PROMPT, BOUNDARY_STYLE_PROMPT_VERSION, PINNED_BOUNDARY_PROMPT, PINNED_BOUNDARY_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.report import ReconstructionReport
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementTask, BookRefinementResponse, RefinementBatch
from ava_pdf_epub.reconstruction_v2.refinement_prompt import REFINEMENT_PROMPT, REFINEMENT_PROMPT_VERSION, BIBLIOGRAPHIC_PROMPT, LEGACY_REFINEMENT_PROMPT
classes = [PrepareResult, ReconstructionInput, RecognitionTask, RecognitionResponse, ReconstructionReport, BookRefinementTask, BookRefinementResponse, RefinementBatch]
print(json.dumps(dict(schemas={c.__name__: c.model_json_schema() for c in classes}, prompt=SYSTEM_PROMPT, promptVersion=PROMPT_VERSION, mergedTablePrompt=MERGED_TABLE_PROMPT, mergedTablePromptVersion=MERGED_TABLE_PROMPT_VERSION, pinnedTablePrompt=PINNED_TABLE_PROMPT, pinnedTablePromptVersion=PINNED_TABLE_PROMPT_VERSION, explicitStylePrompt=EXPLICIT_STYLE_PROMPT, explicitStylePromptVersion=EXPLICIT_STYLE_PROMPT_VERSION, pinnedStylePrompt=PINNED_STYLE_PROMPT, pinnedStylePromptVersion=PINNED_STYLE_PROMPT_VERSION, anchoredStylePrompt=ANCHORED_STYLE_PROMPT, anchoredStylePromptVersion=ANCHORED_STYLE_PROMPT_VERSION, pinnedAnchoredPrompt=PINNED_ANCHORED_PROMPT, pinnedAnchoredPromptVersion=PINNED_ANCHORED_PROMPT_VERSION, boundaryStylePrompt=BOUNDARY_STYLE_PROMPT, boundaryStylePromptVersion=BOUNDARY_STYLE_PROMPT_VERSION, pinnedBoundaryPrompt=PINNED_BOUNDARY_PROMPT, pinnedBoundaryPromptVersion=PINNED_BOUNDARY_PROMPT_VERSION, legacyRefinementPrompt=LEGACY_REFINEMENT_PROMPT, refinementPrompt=REFINEMENT_PROMPT, refinementPromptVersion=REFINEMENT_PROMPT_VERSION, bibliographicPrompt=BIBLIOGRAPHIC_PROMPT),sort_keys=True,separators=(',',':')))
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
    '/* Generated; do not edit. */\nexport const RECOGNITION_PROMPT = ' +
      JSON.stringify(data.prompt) +
      ';\nexport const RECOGNITION_PROMPT_VERSION = ' +
      JSON.stringify(data.promptVersion) +
      ';\nexport const MERGED_TABLE_PROMPT = ' +
      JSON.stringify(data.mergedTablePrompt) +
      ';\nexport const MERGED_TABLE_PROMPT_VERSION = ' +
      JSON.stringify(data.mergedTablePromptVersion) +
      ';\nexport const PINNED_TABLE_PROMPT = ' +
      JSON.stringify(data.pinnedTablePrompt) +
      ';\nexport const PINNED_TABLE_PROMPT_VERSION = ' +
      JSON.stringify(data.pinnedTablePromptVersion) +
      ';\nexport const EXPLICIT_STYLE_PROMPT = ' +
      JSON.stringify(data.explicitStylePrompt) +
      ';\nexport const EXPLICIT_STYLE_PROMPT_VERSION = ' +
      JSON.stringify(data.explicitStylePromptVersion) +
      ';\nexport const PINNED_STYLE_PROMPT = ' +
      JSON.stringify(data.pinnedStylePrompt) +
      ';\nexport const PINNED_STYLE_PROMPT_VERSION = ' +
      JSON.stringify(data.pinnedStylePromptVersion) +
      ';\nexport const ANCHORED_STYLE_PROMPT = ' + JSON.stringify(data.anchoredStylePrompt) +
      ';\nexport const ANCHORED_STYLE_PROMPT_VERSION = ' + JSON.stringify(data.anchoredStylePromptVersion) +
      ';\nexport const PINNED_ANCHORED_PROMPT = ' + JSON.stringify(data.pinnedAnchoredPrompt) +
      ';\nexport const PINNED_ANCHORED_PROMPT_VERSION = ' + JSON.stringify(data.pinnedAnchoredPromptVersion) +
      ';\nexport const BOUNDARY_STYLE_PROMPT = ' + JSON.stringify(data.boundaryStylePrompt) +
      ';\nexport const BOUNDARY_STYLE_PROMPT_VERSION = ' + JSON.stringify(data.boundaryStylePromptVersion) +
      ';\nexport const PINNED_BOUNDARY_PROMPT = ' + JSON.stringify(data.pinnedBoundaryPrompt) +
      ';\nexport const PINNED_BOUNDARY_PROMPT_VERSION = ' + JSON.stringify(data.pinnedBoundaryPromptVersion) +
      ';\n',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
