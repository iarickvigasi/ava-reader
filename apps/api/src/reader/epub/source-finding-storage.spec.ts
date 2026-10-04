import { EpubSourceFindingError } from './source-finding';
import {
  readerProcessingFailure,
  readerFailureMessage,
} from './source-finding-storage';

it('retains a bounded source finding independently from its minimal reader message', () => {
  const error = new EpubSourceFindingError({
    schema: 'ava.epub-source-finding.v1',
    code: 'EPUB_UNSUPPORTED_LIST_FLOW',
    source: { elementTag: 'li', siblingIndex: 2, treePath: [0, 2] },
  }).withResourcePath('EPUB/chapter.xhtml');
  const stored = readerProcessingFailure(error);
  expect(stored).toContain('EPUB/chapter.xhtml');
  expect(stored).toContain('EPUB_UNSUPPORTED_LIST_FLOW');
  expect(readerFailureMessage(stored)).toBe(
    'This EPUB contains a structure AVA cannot preserve.',
  );
  expect(readerFailureMessage('AVA_EPUB_SOURCE_FINDING:malformed')).toBe(
    'This EPUB contains a structure AVA cannot preserve.',
  );
  expect(readerFailureMessage('Existing specific failure.')).toBe(
    'Existing specific failure.',
  );
});
