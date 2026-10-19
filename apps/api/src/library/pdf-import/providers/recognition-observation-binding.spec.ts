import { recognitionObservationDecoder } from './recognition-observation-output';
import {
  observationTask,
  observationResponse,
} from './recognition-observation-fixture';
it.each(['page', 'source', 'image', 'context', 'prompt'])(
  'refuses inconsistent trusted %s before preparing a decoder',
  (change) => {
    const raw = structuredClone(observationTask);
    if (change === 'page') raw.pageIndices[0] = 5;
    if (change === 'source') raw.sourceSha256 = 'b'.repeat(64);
    if (change === 'prompt')
      raw.messages[0].content = (raw.messages[0].content as string) + 'changed';
    const content = raw.messages[1].content;
    if (
      typeof content === 'string' ||
      content[0].type !== 'text' ||
      content[1].type !== 'image_url'
    )
      throw Error('fixture');
    if (change === 'context')
      content[0].text = content[0].text.replace('render_sha256', 'wrong');
    if (change === 'image')
      content[1].image_url.url = content[1].image_url.url.replace(
        'base64,',
        'base64,AAAA',
      );
    expect(() => recognitionObservationDecoder(raw)).toThrow(
      'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
    );
  },
);
it('never returns malformed JSON or loses a supplied semantic refusal', () => {
  const decode = recognitionObservationDecoder(observationTask);
  expect(() => decode('{')).toThrow('PDF_PROVIDER_OUTPUT_INVALID');
  expect(() =>
    decode(
      JSON.stringify({ ...observationResponse, unresolved: ['uncertain'] }),
    ),
  ).toThrow();
});
it.each([
  [
    'style',
    (json: string) =>
      json.replace('"style":null', '"style":{"id":"forbidden"},"style":null'),
  ],
  [
    'version',
    (json: string) =>
      json.replace(
        '"schema_version":',
        '"schema_version":"old","schema_version":',
      ),
  ],
  [
    'observation',
    (json: string) =>
      json.replace('"language":', '"language":"other","language":'),
  ],
] as const)('rejects duplicate %s keys before decoding', (_, corrupt) => {
  expect(() =>
    recognitionObservationDecoder(observationTask)(
      corrupt(JSON.stringify(observationResponse)),
    ),
  ).toThrow('PDF_PROVIDER_OUTPUT_INVALID');
});
