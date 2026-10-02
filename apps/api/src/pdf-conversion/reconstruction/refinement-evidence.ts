import type { BookRefinementTask } from './generated/BookRefinementTask';

// These IDs are mechanical obligations, not a visual judgment for the model.
export function refinementEvidence(task: BookRefinementTask) {
  const crop = (nodeId: string, part: 'head' | 'tail') =>
    task.crops.find((c) => c.node_id === nodeId && c.part === part)?.id;
  return {
    required_decision_evidence: Object.fromEntries(
      task.decision_ids.map((id) => {
        const node = task.nodes.find((n) => n.id === id)!;
        return [
          id,
          [
            ...new Set([
              crop(id, 'head'),
              ...(node.body_reference_id
                ? [crop(node.body_reference_id, 'head')]
                : []),
            ]),
          ],
        ];
      }),
    ),
    ...(task.metadata_ids?.length
      ? {
          required_metadata_evidence: Object.fromEntries(
            task.metadata_ids.map((id) => [id, [crop(id, 'head')]]),
          ),
        }
      : {}),
    required_join_evidence: Object.fromEntries(
      task.edges.map((edge) => [
        edge.id,
        [
          crop(edge.previous_id, 'tail') ?? crop(edge.previous_id, 'head'),
          crop(edge.next_id, 'head'),
        ],
      ]),
    ),
  };
}
