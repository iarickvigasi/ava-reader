"""Authored test responses cite the actual endpoint parts supplied by each task."""


def join_decisions(task, join):
    heads = {c.node_id: c.id for c in task.crops if c.part == "head"}
    tails = {c.node_id: c.id for c in task.crops if c.part == "tail"}
    return [
        dict(
            edge_id=edge.id,
            join=join,
            evidence_ids=[
                tails.get(edge.previous_id, heads[edge.previous_id]),
                heads[edge.next_id],
            ],
        )
        for edge in task.edges
    ]
