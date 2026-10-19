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
from ava_pdf_epub.reconstruction_v2.protocol import PrepareResult, ReconstructionInput, PrintedTitleReconstructionInput
from ava_pdf_epub.reconstruction_v2.protocol_native_layout import NativeLayoutPrepareResult, NativeLayoutReconstructionInput
from ava_pdf_epub.reconstruction_v2.protocol_native_structure import NativeStructurePrepareResult, NativeStructureReconstructionInput
from ava_pdf_epub.reconstruction_v2.protocol_native_word_wrap import NativeWordWrapPrepareResult, NativeWordWrapReconstructionInput
from ava_pdf_epub.reconstruction_v2.protocol_cell_geometry import CellGeometryReconstructionInput
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_contract import RecognitionCellGeometryTask, RecognitionCellGeometryResponse, RecognitionCellGeometryProof, CELL_GEOMETRY_PROMPT, CELL_GEOMETRY_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.protocol_recognition_geometry import RecognitionGeometryReconstructionInput
from ava_pdf_epub.reconstruction_v2.protocol_frontmatter_title import FrontmatterTitleReconstructionInput, FrontmatterTitleRefinementBatch
from ava_pdf_epub.reconstruction_v2.printed_title_v2_contract import FrontmatterTitleTask, FrontmatterTitleResponse
from ava_pdf_epub.reconstruction_v2.printed_title_v2_prompt import PRINTED_TITLE_V2_PROMPT, PRINTED_TITLE_V2_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.recognition_geometry_contract import RecognitionGeometryTask, RecognitionGeometryResponse, RecognitionGeometryProof
from ava_pdf_epub.reconstruction_v2.recognition_geometry_prompt import GEOMETRY_PROMPT, GEOMETRY_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.word_wrap_contract import WordWrapTask, WordWrapResponse, WordWrapBatch
from ava_pdf_epub.reconstruction_v2.word_wrap_prompt import WORD_WRAP_PROMPT, WORD_WRAP_PROMPT_VERSION, WORD_WRAP_RESPONSE_SCHEMA_VERSION
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionTask, RecognitionResponse
from ava_pdf_epub.reconstruction_v2.native_structure_contract import NativeStructureTask, NativeStructureResponse
from ava_pdf_epub.reconstruction_v2.native_structure_v2_contract import NativeStructureTask2, NativeStructureResponse2
from ava_pdf_epub.reconstruction_v2.protocol_native_structure_v2 import NativeStructure2PrepareResult, NativeStructure2ReconstructionInput
from ava_pdf_epub.reconstruction_v2.native_structure_v2_prompt import NATIVE_STRUCTURE_V2_PROMPT, NATIVE_STRUCTURE_V2_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.native_structure_prompt import NATIVE_STRUCTURE_PROMPT, NATIVE_STRUCTURE_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.small_caps_quote_contract import RecognitionSmallCapsQuoteTask, SMALL_CAPS_QUOTE_PROMPT, SMALL_CAPS_QUOTE_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.recognition_anchor_quote_contract import RecognitionAnchorQuoteTask, RecognitionAnchorQuoteResponse, ANCHOR_QUOTE_PROMPT, ANCHOR_QUOTE_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.recognition_anchor_context import RecognitionAnchorContextTask, RecognitionAnchorContextResponse, ANCHOR_CONTEXT_PROMPT, ANCHOR_CONTEXT_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.overflow_context_contract import RecognitionOverflowContextTask, PROMPT as OVERFLOW_CONTEXT_PROMPT, PROMPT_VERSION as OVERFLOW_CONTEXT_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2 import recognition_prompt, ordered_list_prompt, text_style_prompt, index_prompt
from ava_pdf_epub.reconstruction_v2.report import ReconstructionReport, AnyReconstructionReport
from pydantic import TypeAdapter
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementTask, BookRefinementResponse, RefinementBatch, PrintedTitleRefinementBatch
from ava_pdf_epub.reconstruction_v2.printed_title_contract import PrintedTitleTask, PrintedTitleResponse
from ava_pdf_epub.reconstruction_v2.printed_title_prompt import PRINTED_TITLE_PROMPT, PRINTED_TITLE_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.refinement_prompt import REFINEMENT_PROMPT, REFINEMENT_PROMPT_VERSION, BIBLIOGRAPHIC_PROMPT, LEGACY_REFINEMENT_PROMPT, MIXED_HIERARCHY_PROMPT, MIXED_HIERARCHY_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.source_feature_prompt import SOURCE_FEATURE_PROMPT, SOURCE_FEATURE_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.source_feature_task_contract import SourceFeatureTask, SourceFeatureResponse
from ava_pdf_epub.reconstruction_v2.protocol_continuation import ContinuationReconstructionInput, ContinuationRefinementBatch
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import PresentationRefinementTask, PresentationRefinementResponse, PROMPT_VERSION as CONTINUATION_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.continuation_presentation_prompt import CONTINUATION_PROMPT
from ava_pdf_epub.reconstruction_v2.source_role_contract import SourceRoleTask, SourceRoleResponse
from ava_pdf_epub.reconstruction_v2.source_role_prompt import SOURCE_ROLE_PROMPT
classes = [SourceRoleTask, SourceRoleResponse, RecognitionSmallCapsQuoteTask, RecognitionOverflowContextTask, ContinuationReconstructionInput, ContinuationRefinementBatch, PresentationRefinementTask, PresentationRefinementResponse, CellGeometryReconstructionInput, RecognitionCellGeometryTask, RecognitionCellGeometryResponse, RecognitionCellGeometryProof, RecognitionAnchorQuoteTask, RecognitionAnchorQuoteResponse, NativeStructureTask2, NativeStructureResponse2, NativeStructure2PrepareResult, NativeStructure2ReconstructionInput, FrontmatterTitleReconstructionInput, FrontmatterTitleRefinementBatch, FrontmatterTitleTask, FrontmatterTitleResponse, RecognitionGeometryReconstructionInput, RecognitionGeometryTask, RecognitionGeometryResponse, RecognitionGeometryProof, NativeWordWrapPrepareResult, NativeWordWrapReconstructionInput, WordWrapTask, WordWrapResponse, WordWrapBatch, NativeStructurePrepareResult, NativeStructureReconstructionInput, NativeStructureTask, NativeStructureResponse, SourceFeatureTask, SourceFeatureResponse, PrepareResult, ReconstructionInput, RecognitionTask, RecognitionResponse, ReconstructionReport, BookRefinementTask, BookRefinementResponse, RefinementBatch, PrintedTitleTask, PrintedTitleResponse, PrintedTitleRefinementBatch, PrintedTitleReconstructionInput, NativeLayoutPrepareResult, NativeLayoutReconstructionInput, RecognitionAnchorContextTask, RecognitionAnchorContextResponse]
prompts = [("SMALL_CAPS_QUOTE_PROMPT", SMALL_CAPS_QUOTE_PROMPT), ("SMALL_CAPS_QUOTE_PROMPT_VERSION", SMALL_CAPS_QUOTE_PROMPT_VERSION), ("OVERFLOW_CONTEXT_PROMPT", OVERFLOW_CONTEXT_PROMPT), ("OVERFLOW_CONTEXT_PROMPT_VERSION", OVERFLOW_CONTEXT_PROMPT_VERSION), ("CELL_GEOMETRY_PROMPT", CELL_GEOMETRY_PROMPT), ("CELL_GEOMETRY_PROMPT_VERSION", CELL_GEOMETRY_PROMPT_VERSION), ("RECOGNITION_PROMPT", recognition_prompt.SYSTEM_PROMPT), ("RECOGNITION_PROMPT_VERSION", recognition_prompt.PROMPT_VERSION)]
for prefix in ("MERGED_TABLE", "PINNED_TABLE", "EXPLICIT_STYLE", "PINNED_STYLE", "ANCHORED_STYLE", "PINNED_ANCHORED", "BOUNDARY_STYLE", "PINNED_BOUNDARY", "UNICODE_STYLE", "PINNED_UNICODE"):
    for suffix in ("_PROMPT", "_PROMPT_VERSION"):
        name = prefix + suffix
        prompts.append((name, getattr(recognition_prompt, name)))
for name in ("ORDERED_LIST_PROMPT", "ORDERED_LIST_PROMPT_VERSION", "PINNED_ORDERED_LIST_PROMPT", "PINNED_ORDERED_LIST_PROMPT_VERSION"):
    prompts.append((name, getattr(ordered_list_prompt, name)))
for name in ("TEXT_STYLE_PROMPT", "TEXT_STYLE_PROMPT_VERSION", "PINNED_TEXT_STYLE_PROMPT", "PINNED_TEXT_STYLE_PROMPT_VERSION"):
    prompts.append((name, getattr(text_style_prompt, name)))
for name in ("INDEX_PROMPT", "INDEX_PROMPT_VERSION"):
    prompts.append((name, getattr(index_prompt, name)))
schemas = {c.__name__: c.model_json_schema() for c in classes}
schemas["ReconstructionReport"] = TypeAdapter(AnyReconstructionReport).json_schema()
print(json.dumps(dict(schemas=schemas, prompts=prompts, sourceRolePrompt=SOURCE_ROLE_PROMPT, continuationPrompt=CONTINUATION_PROMPT, continuationPromptVersion=CONTINUATION_PROMPT_VERSION, legacyRefinementPrompt=LEGACY_REFINEMENT_PROMPT, refinementPrompt=REFINEMENT_PROMPT, refinementPromptVersion=REFINEMENT_PROMPT_VERSION, bibliographicPrompt=BIBLIOGRAPHIC_PROMPT, mixedHierarchyPrompt=MIXED_HIERARCHY_PROMPT, mixedHierarchyPromptVersion=MIXED_HIERARCHY_PROMPT_VERSION, sourceFeaturePrompt=SOURCE_FEATURE_PROMPT, sourceFeaturePromptVersion=SOURCE_FEATURE_PROMPT_VERSION, printedTitlePrompt=PRINTED_TITLE_PROMPT, printedTitlePromptVersion=PRINTED_TITLE_PROMPT_VERSION, nativeStructureV2Prompt=NATIVE_STRUCTURE_V2_PROMPT, nativeStructureV2PromptVersion=NATIVE_STRUCTURE_V2_PROMPT_VERSION, nativeStructurePrompt=NATIVE_STRUCTURE_PROMPT, nativeStructurePromptVersion=NATIVE_STRUCTURE_PROMPT_VERSION, wordWrapPrompt=WORD_WRAP_PROMPT, wordWrapPromptVersion=WORD_WRAP_PROMPT_VERSION, wordWrapResponseSchemaVersion=WORD_WRAP_RESPONSE_SCHEMA_VERSION, anchorQuotePrompt=ANCHOR_QUOTE_PROMPT, anchorQuotePromptVersion=ANCHOR_QUOTE_PROMPT_VERSION, anchorContextPrompt=ANCHOR_CONTEXT_PROMPT, anchorContextPromptVersion=ANCHOR_CONTEXT_PROMPT_VERSION, geometryPrompt=GEOMETRY_PROMPT, geometryPromptVersion=GEOMETRY_PROMPT_VERSION, printedTitleV2Prompt=PRINTED_TITLE_V2_PROMPT, printedTitleV2PromptVersion=PRINTED_TITLE_V2_PROMPT_VERSION),sort_keys=True,separators=(',',':')))
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
    'source-role-prompt.ts',
    '/* Generated; do not edit. */\nexport const SOURCE_ROLE_PROMPT = ' +
      JSON.stringify(data.sourceRolePrompt) +
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
      ';\nexport const MIXED_HIERARCHY_PROMPT = ' +
      JSON.stringify(data.mixedHierarchyPrompt) +
      ';\nexport const MIXED_HIERARCHY_PROMPT_VERSION = ' +
      JSON.stringify(data.mixedHierarchyPromptVersion) +
      ';\nexport const SOURCE_FEATURE_PROMPT = ' +
      JSON.stringify(data.sourceFeaturePrompt) +
      ';\nexport const SOURCE_FEATURE_PROMPT_VERSION = ' +
      JSON.stringify(data.sourceFeaturePromptVersion) +
      ';\nexport const CONTINUATION_PROMPT = ' +
      JSON.stringify(data.continuationPrompt) +
      ';\nexport const CONTINUATION_PROMPT_VERSION = ' +
      JSON.stringify(data.continuationPromptVersion) +
      ';\n',
  );
  await emit(
    'printed-title-prompt.ts',
    '/* Generated; do not edit. */\nexport const PRINTED_TITLE_PROMPT = ' +
      JSON.stringify(data.printedTitlePrompt) +
      ';\nexport const PRINTED_TITLE_PROMPT_VERSION = ' +
      JSON.stringify(data.printedTitlePromptVersion) +
      ';\n',
  );
  await emit(
    'printed-title-v2-prompt.ts',
    '/* Generated; do not edit. */\nexport const PRINTED_TITLE_V2_PROMPT = ' +
      JSON.stringify(data.printedTitleV2Prompt) +
      ';\nexport const PRINTED_TITLE_V2_PROMPT_VERSION = ' +
      JSON.stringify(data.printedTitleV2PromptVersion) +
      ';\n',
  );
  await emit(
    'geometry-prompt.ts',
    '/* Generated; do not edit. */\nexport const GEOMETRY_PROMPT = ' +
      JSON.stringify(data.geometryPrompt) +
      ';\nexport const GEOMETRY_PROMPT_VERSION = ' +
      JSON.stringify(data.geometryPromptVersion) +
      ';\n',
  );
  await emit(
    'anchor-quote-prompt.ts',
    '/* Generated; do not edit. */\nexport const ANCHOR_QUOTE_PROMPT = ' +
      JSON.stringify(data.anchorQuotePrompt) +
      ';\nexport const ANCHOR_QUOTE_PROMPT_VERSION = ' +
      JSON.stringify(data.anchorQuotePromptVersion) +
      ';\n',
  );
  await emit(
    'anchor-context-prompt.ts',
    '/* Generated; do not edit. */\nexport const ANCHOR_CONTEXT_PROMPT = ' +
      JSON.stringify(data.anchorContextPrompt) +
      ';\nexport const ANCHOR_CONTEXT_PROMPT_VERSION = ' +
      JSON.stringify(data.anchorContextPromptVersion) +
      ';\n',
  );
  await emit(
    'word-wrap-prompt.ts',
    '/* Generated; do not edit. */\nexport const WORD_WRAP_PROMPT = ' +
      JSON.stringify(data.wordWrapPrompt) +
      ';\nexport const WORD_WRAP_PROMPT_VERSION = ' +
      JSON.stringify(data.wordWrapPromptVersion) +
      ';\nexport const WORD_WRAP_RESPONSE_SCHEMA_VERSION = ' +
      JSON.stringify(data.wordWrapResponseSchemaVersion) +
      ';\n',
  );
  await emit(
    'native-structure-v2-prompt.ts',
    '/* Generated; do not edit. */\nexport const NATIVE_STRUCTURE_V2_PROMPT = ' +
      JSON.stringify(data.nativeStructureV2Prompt) +
      ';\nexport const NATIVE_STRUCTURE_V2_PROMPT_VERSION = ' +
      JSON.stringify(data.nativeStructureV2PromptVersion) +
      ';\n',
  );
  await emit(
    'native-structure-prompt.ts',
    '/* Generated; do not edit. */\nexport const NATIVE_STRUCTURE_PROMPT = ' +
      JSON.stringify(data.nativeStructurePrompt) +
      ';\nexport const NATIVE_STRUCTURE_PROMPT_VERSION = ' +
      JSON.stringify(data.nativeStructurePromptVersion) +
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
