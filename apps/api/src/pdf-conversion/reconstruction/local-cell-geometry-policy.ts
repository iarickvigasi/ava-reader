import { LOCAL_CELL_OCR_POLICY } from '../../library/pdf-import/admission/cell-ocr-policy';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function assertLocalCellGeometryPolicy(input: {
  localCellGeometryPolicy?: string;
  sourceLayoutPolicy?: string;
  sourceStructurePolicy?: string;
  sourceNormalizationPolicy?: string;
  recognitionRepairPolicy?: string;
  sourceTitlePolicy?: string;
  sourceContinuationPolicy?: string;
}) {
  if (
    input.localCellGeometryPolicy !== undefined &&
    (input.localCellGeometryPolicy !== LOCAL_CELL_OCR_POLICY ||
      input.sourceLayoutPolicy !== 'ava-native-layout-1' ||
      input.sourceStructurePolicy !== 'ava-native-structure-2' ||
      input.sourceNormalizationPolicy !== 'ava-native-word-wrap-1' ||
      input.recognitionRepairPolicy !== 'ava-recognition-geometry-repair-2' ||
      input.sourceTitlePolicy !== 'ava-frontmatter-title-1' ||
      input.sourceContinuationPolicy !==
        'ava-source-continuation-presentation-1')
  )
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
}
