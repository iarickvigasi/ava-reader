import {
  observationResponse,
  observationTask,
} from './recognition-observation-fixture';
import { recognitionObservationDecoder } from './recognition-observation-output';
import { prepareFigureAltRepair } from './figure-alt-repair';
import { FIGURE_ALT_SCHEMA_VERSION } from './figure-alt-contract';
export const figureResponse = () => {
  const r = structuredClone(observationResponse);
  Object.assign(r.segments[0], {
    kind: 'figure',
    text: 'A1  A2\nB1  B2',
    spans: [],
  });
  delete r.segments[0].alt;
  return r;
};
export const figureParent = {
  callId: 'original-call',
  requestSha256: 'a'.repeat(64),
};
export const prepareFigure = (raw = figureResponse()) =>
  prepareFigureAltRepair(
    observationTask,
    JSON.stringify(raw),
    figureParent,
    recognitionObservationDecoder(observationTask),
  );
export function figureAnswer(repair: ReturnType<typeof prepareFigure>) {
  const content = repair.task.messages[1].content;
  if (typeof content === 'string' || content[0].type !== 'text')
    throw Error('fixture');
  const context = JSON.parse(content[0].text) as {
    parent_output_sha256: string;
    figures: { segment_id: string }[];
  };
  return {
    schema_version: FIGURE_ALT_SCHEMA_VERSION,
    task_id: repair.task.taskId,
    parent_output_sha256: context.parent_output_sha256,
    outcome: 'described',
    patches: context.figures.map((f) => ({
      segment_id: f.segment_id,
      alt: 'Two aligned rows of labels: A1 and A2 above B1 and B2.',
    })),
  };
}
